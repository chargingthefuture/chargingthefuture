import { NextResponse } from 'next/server';
import { ensureMutationCsrf, parsePositiveInteger, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { TRUSTTRANSPORT_DEFAULT_PAGE, TRUSTTRANSPORT_DEFAULT_PAGE_SIZE, TRUSTTRANSPORT_ERROR_CODE, TRUSTTRANSPORT_MODES } from 'lib/trusttransport/constants';
import { createRequest, listRequests, validateRequestInput } from 'lib/trusttransport/repository';
import type { TrustTransportMode, TrustTransportRequestInput } from 'lib/trusttransport/types';
import { reportError } from 'lib/observability/report';

function parseRequestInput(body: Record<string, unknown>): TrustTransportRequestInput {
  const modeValue = typeof body.mode === 'string' ? body.mode : 'ride';
  const mode = (TRUSTTRANSPORT_MODES as readonly string[]).includes(modeValue)
    ? (modeValue as TrustTransportMode)
    : 'ride';

  return {
    mode,
    title: typeof body.title === 'string' ? body.title : '',
    details: typeof body.details === 'string' ? body.details : '',
    pickupCity: typeof body.pickupCity === 'string' ? body.pickupCity : null,
    dropoffCity: typeof body.dropoffCity === 'string' ? body.dropoffCity : null,
    pickupGeoRedacted: typeof body.pickupGeoRedacted === 'string' ? body.pickupGeoRedacted : null,
    dropoffGeoRedacted: typeof body.dropoffGeoRedacted === 'string' ? body.dropoffGeoRedacted : null,
  };
}

export async function GET(request: Request) {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), TRUSTTRANSPORT_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), TRUSTTRANSPORT_DEFAULT_PAGE_SIZE);
    const response = await listRequests({ page, pageSize, requesterUserId: gate.auth.userId });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'requests' });
    return trustTransportErrorResponse(error, 'Request listing unavailable.');
  }
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseRequestInput(body);
  if (!validateRequestInput(input)) {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid request payload.' },
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
    reportError(error, { area: 'trusttransport', op: 'requests' });
    return trustTransportErrorResponse(error, 'Request create unavailable.');
  }
}
