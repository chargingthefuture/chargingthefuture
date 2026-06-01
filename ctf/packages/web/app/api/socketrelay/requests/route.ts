import { NextResponse } from 'next/server';
import { ensureMutationCsrf, parsePositiveInteger, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { SOCKETRELAY_DEFAULT_PAGE, SOCKETRELAY_DEFAULT_PAGE_SIZE, SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
import { createRequest, listRequests, validateRequestInput } from 'lib/socketrelay/repository';
import type { SocketRelayRequestInput } from 'lib/socketrelay/types';
import { reportError } from 'lib/observability/report';

function parseRequestInput(body: Record<string, unknown>): SocketRelayRequestInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    details: typeof body.details === 'string' ? body.details : '',
    category: typeof body.category === 'string' ? body.category : '',
    city: typeof body.city === 'string' ? body.city : null,
    isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : false,
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
  if (!validateRequestInput(input)) {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.invalidPayload, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
    ? body.idempotencyKey.trim()
    : `${gate.auth.userId}:${Date.now()}`;

  try {
    const item = await createRequest(gate.auth.userId, input, idempotencyKey);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'requests' });
    return socketRelayErrorResponse(error, 'Request create unavailable.');
  }
}
