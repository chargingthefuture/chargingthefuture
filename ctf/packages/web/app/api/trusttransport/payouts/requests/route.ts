import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportProviderAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { TRUSTTRANSPORT_ERROR_CODE } from 'lib/trusttransport/constants';
import { requestPayout } from 'lib/trusttransport/repository';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportProviderAccess();
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

  const amount = typeof body.amount === 'number' ? body.amount : Number.NaN;
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
    ? body.idempotencyKey.trim()
    : `${gate.auth.userId}:${Date.now()}`;

  try {
    const payout = await requestPayout(gate.auth.userId, amount, idempotencyKey);
    return NextResponse.json({ ok: true, payout }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'payouts_requests' });
    return trustTransportErrorResponse(error, 'Payout request unavailable.');
  }
}
