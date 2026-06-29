import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, ensureMutationCsrf } from 'lib/trust-transport/_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { insertTrustTransportAudit } from 'lib/trust-transport/repository';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { reportError } from 'lib/observability/report';

type TrustTransportServiceCreditsSendInput = {
  toUserId: string;
  amount: number;
  message?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let input: TrustTransportServiceCreditsSendInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON.' }, { status: 400 });
  }

  if (!input.toUserId || typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
  }

  // A self-transfer is a no-op move within one wallet that only adds ledger noise and could be used to
  // pad transfer counts; reject it before touching the ledger.
  if (input.toUserId === gate.auth.userId) {
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Cannot transfer credits to yourself.' }, { status: 400 });
  }

  try {
    const idempotencyKey =
      typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim().length > 0
        ? input.idempotencyKey.trim()
        : `trust-transport-${gate.auth.userId}-${Date.now()}`;

    const tx = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: input.toUserId,
      amount: input.amount,
      idempotencyKey,
      originPlugin: 'trust-transport',
      reasonCode: input.message && input.message.trim().length > 0 ? 'trust-transport.transfer.message' : 'trust-transport.transfer',
    });

    // Cross-user credit transfers are a financial mutation inside this plugin; record an audit event so
    // the trail matches the other money mutation here (payout.request).
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.service-credits.transfer',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'transfer',
      targetId: tx.id,
      metadata: { toUserId: input.toUserId, amount: input.amount },
    });

    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'service_credits' });
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.persistenceUnavailable, message: 'Unable to send ServiceCredits.' }, { status: 503 });
  }
}
