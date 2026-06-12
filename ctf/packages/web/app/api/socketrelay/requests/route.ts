import { NextResponse } from 'next/server';
import { ensureMutationCsrf, parsePositiveInteger, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { SOCKETRELAY_DEFAULT_PAGE, SOCKETRELAY_DEFAULT_PAGE_SIZE, SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
import { createRequest, isValidRequestPrice, listRequests, validateRequestInput } from 'lib/socketrelay/repository';
import type { SocketRelayRequestInput } from 'lib/socketrelay/types';
import { reportError } from 'lib/observability/report';

// Only a real number or a non-empty numeric string becomes an amount; booleans, arrays, objects, and
// `null`/`undefined` never coerce to a price (so e.g. `true` is not read as 1).
function parsePriceAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

// Older clients send a single `category` string; newer ones send a `tags` array (1-3).
function parseTags(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.tags)) {
    return body.tags.filter((tag): tag is string => typeof tag === 'string');
  }
  return typeof body.category === 'string' && body.category.trim() ? [body.category] : [];
}

function parseRequestInput(body: Record<string, unknown>): SocketRelayRequestInput {
  // Value type (issue #420): a non-empty currency code names how the request is settled; an absent/blank
  // code means none was chosen. Amount is only kept as a positive finite number; anything else is null
  // (so amount-less types like Free/Barter carry no amount).
  const priceCurrency =
    typeof body.priceCurrency === 'string' && body.priceCurrency.trim().length > 0
      ? body.priceCurrency.trim()
      : null;
  const priceAmount = parsePriceAmount(body.priceAmount);
  return {
    title: typeof body.title === 'string' ? body.title : '',
    details: typeof body.details === 'string' ? body.details : '',
    tags: parseTags(body),
    city: typeof body.city === 'string' ? body.city : null,
    isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : false,
    priceCurrency,
    priceAmount,
  };
}

export async function GET(request: Request) {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), SOCKETRELAY_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), SOCKETRELAY_DEFAULT_PAGE_SIZE);
    const response = await listRequests({ page, pageSize });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'requests' });
    return socketRelayErrorResponse(error, 'Request listing unavailable.');
  }
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseRequestInput(body);
  if (!validateRequestInput(input) || !(await isValidRequestPrice(input.priceCurrency, input.priceAmount))) {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.invalidPayload, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
    ? body.idempotencyKey.trim()
    : `${gate.auth.userId}:${Date.now()}`;

  try {
    const item = await createRequest(gate.auth.userId, gate.auth.username ?? null, input, idempotencyKey);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'requests' });
    return socketRelayErrorResponse(error, 'Request create unavailable.');
  }
}
