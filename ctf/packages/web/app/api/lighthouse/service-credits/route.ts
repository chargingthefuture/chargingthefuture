import { NextResponse } from 'next/server';
import { requireLighthouseReadAccess, ensureMutationCsrf } from 'lib/lighthouse/_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { reportError } from 'lib/observability/report';

type LighthouseServiceCreditsSendInput = {
  toUserId: string;
  amount: number;
  message?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let input: LighthouseServiceCreditsSendInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid JSON.' }, { status: 400 });
  }

  if (!input.toUserId || typeof input.amount !== 'number' || input.amount <= 0) {
    return NextResponse.json({ ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
  }

  try {
    const idempotencyKey =
      typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim().length > 0
        ? input.idempotencyKey.trim()
        : `lighthouse-${gate.auth.userId}-${Date.now()}`;

    const tx = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: input.toUserId,
      amount: input.amount,
      idempotencyKey,
      originPlugin: 'lighthouse',
      reasonCode: 'lighthouse.transfer',
    });

    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'service_credits_send', extra: { userId: gate.auth.userId } });
    return NextResponse.json({ ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Unable to send service credits.' }, { status: 503 });
  }
}
