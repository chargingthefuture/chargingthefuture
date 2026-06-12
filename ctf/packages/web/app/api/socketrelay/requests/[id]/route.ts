import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
import { getRequestById, isValidRequestPrice, updateRequest, validateRequestInput } from 'lib/socketrelay/repository';
import type { SocketRelayRequestInput } from 'lib/socketrelay/types';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ id: string }>;
};

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

function parseRequestInput(body: Record<string, unknown>): SocketRelayRequestInput {
  const priceCurrency =
    typeof body.priceCurrency === 'string' && body.priceCurrency.trim().length > 0
      ? body.priceCurrency.trim()
      : null;
  const priceAmount = parsePriceAmount(body.priceAmount);
  return {
    title: typeof body.title === 'string' ? body.title : '',
    details: typeof body.details === 'string' ? body.details : '',
    category: typeof body.category === 'string' ? body.category : '',
    city: typeof body.city === 'string' ? body.city : null,
    isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : false,
    priceCurrency,
    priceAmount,
  };
}

export async function GET(_: Request, { params }: RouteProps) {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await params;

  try {
    const item = await getRequestById(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, code: SOCKETRELAY_ERROR_CODE.requestNotFound, message: 'SocketRelay request not found.' },
        { status: 404 },
      );
    }

    const isVisibleToActor = item.isPublic || item.ownerUserId === gate.auth.userId || gate.auth.isAdmin;
    if (!isVisibleToActor) {
      return NextResponse.json(
        { ok: false, code: SOCKETRELAY_ERROR_CODE.policyDenied, message: 'Operation denied by policy.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'requests_id' });
    return socketRelayErrorResponse(error, 'Request lookup unavailable.');
  }
}

export async function PUT(request: Request, { params }: RouteProps) {
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

  const { id } = await params;

  try {
    const item = await updateRequest(id, gate.auth.userId, gate.auth.isAdmin, input);
    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'requests_id' });
    return socketRelayErrorResponse(error, 'Request update unavailable.');
  }
}
