import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { TRUSTTRANSPORT_ERROR_CODE } from 'lib/trusttransport/constants';
import { acceptOffer } from 'lib/trusttransport/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ offerId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { offerId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  if (!requestId) {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'requestId is required.' },
      { status: 400 },
    );
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
    ? body.idempotencyKey.trim()
    : `${gate.auth.userId}:${Date.now()}`;

  try {
    const result = await acceptOffer(requestId, offerId, gate.auth.userId, idempotencyKey);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'offer_accept', extra: { userId: gate.auth.userId, offerId, requestId } });
    return trustTransportErrorResponse(error, 'Offer accept unavailable.');
  }
}
