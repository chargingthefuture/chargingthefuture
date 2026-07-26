import { NextResponse } from 'next/server';
import { ensureMutationCsrf, parsePositiveInteger, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import {
  SOCKET_RELAY_DEFAULT_PAGE,
  SOCKET_RELAY_DEFAULT_PAGE_SIZE,
  SOCKET_RELAY_ERROR_CODE,
  SOCKET_RELAY_TAG_LENGTH_MESSAGE,
} from 'lib/socket-relay/constants';
import {
  createRequest,
  hasOverlongTag,
  insertSocketRelayAudit,
  isValidRequestPrice,
  listRequests,
  validateRequestInput,
} from 'lib/socket-relay/repository';
import type { SocketRelayRequestInput } from 'lib/socket-relay/types';
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
    state: typeof body.state === 'string' ? body.state : null,
    country: typeof body.country === 'string' ? body.country : null,
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
    const page = parsePositiveInteger(url.searchParams.get('page'), SOCKET_RELAY_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), SOCKET_RELAY_DEFAULT_PAGE_SIZE);
    const response = await listRequests({ page, pageSize });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'requests' });
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
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseRequestInput(body);
  // Answer the one payload problem a caller can act on by itself before the catch-all message below.
  if (hasOverlongTag(input.tags)) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: SOCKET_RELAY_TAG_LENGTH_MESSAGE },
      { status: 400 },
    );
  }

  if (!validateRequestInput(input) || !(await isValidRequestPrice(input.priceCurrency, input.priceAmount))) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
    ? body.idempotencyKey.trim()
    : `${gate.auth.userId}:${Date.now()}`;

  try {
    const item = await createRequest(gate.auth.userId, gate.auth.username ?? null, input, idempotencyKey);
    await insertSocketRelayAudit({
      actorId: gate.auth.userId,
      command: 'socket-relay.request.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'request',
      targetId: item.id,
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'requests' });
    return socketRelayErrorResponse(error, 'Request create unavailable.');
  }
}
