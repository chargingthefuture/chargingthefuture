import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, ensureMutationCsrf } from 'lib/trust-transport/_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { reportError } from 'lib/observability/report';

type TrustTransportServiceCreditsSendInput = {
  toUserId: string;
  amount: number;
  message?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let input: TrustTransportServiceCreditsSendInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON.' }, { status: 400 });
  }

  if (!input.toUserId || typeof input.amount !== 'number' || input.amount <= 0) {
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
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

    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'service_credits' });
    return NextResponse.json({ ok: false, code: TRUST_TRANSPORT_ERROR_CODE.persistenceUnavailable, message: 'Unable to send ServiceCredits.' }, { status: 503 });
  }
}
