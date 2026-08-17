import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, ensureMutationCsrf, resolveIdempotencyKey } from 'lib/trust-transport/_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { insertTrustTransportAudit } from 'lib/trust-transport/repository';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type TrustTransportServiceCreditsSendInput = {
  toUserId: string;
  amount: number;
  message?: string;
  idempotencyKey?: string;
};

// A transfer amount must be a positive finite number; booleans, strings, and null never qualify.
function isValidTransferAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
}

// A non-empty message marks the transfer with the message reason code; otherwise the plain reason.
function transferReasonCode(message: unknown): string {
  return typeof message === 'string' && message.trim().length > 0
    ? 'trust-transport.transfer.message'
    : 'trust-transport.transfer';
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

  let input: TrustTransportServiceCreditsSendInput;
  try {
    input = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON.', reason: failureReason(error) }, { status: 400 });
  }

  if (!input.toUserId || !isValidTransferAmount(input.amount)) {
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
  }

  // A self-transfer is a no-op move within one wallet that only adds ledger noise and could be used to
  // pad transfer counts; reject it before touching the ledger.
  if (input.toUserId === gate.auth.userId) {
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Cannot transfer credits to yourself.' }, { status: 400 });
  }

  try {
    const idempotencyKey = resolveIdempotencyKey(
      input.idempotencyKey,
      `trust-transport-${gate.auth.userId}-${Date.now()}`,
    );

    const tx = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: input.toUserId,
      amount: input.amount,
      idempotencyKey,
      originPlugin: 'trust-transport',
      reasonCode: transferReasonCode(input.message),
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
