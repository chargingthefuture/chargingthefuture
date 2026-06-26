import { NextResponse } from 'next/server';
import { requireSocketRelayReadAccess, ensureMutationCsrf } from 'lib/socket-relay/_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import { reportError } from 'lib/observability/report';

type SocketRelayServiceCreditsSendInput = {
  toUserId: string;
  amount: number;
  message?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let input: SocketRelayServiceCreditsSendInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON.' }, { status: 400 });
  }

  if (!input.toUserId || typeof input.amount !== 'number' || input.amount <= 0) {
    return NextResponse.json({ ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
  }

  try {
    const idempotencyKey =
      typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim().length > 0
        ? input.idempotencyKey.trim()
        : `socket-relay-${gate.auth.userId}-${Date.now()}`;

    const tx = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: input.toUserId,
      amount: input.amount,
      idempotencyKey,
      originPlugin: 'socket-relay',
      reasonCode: 'socket-relay.transfer',
    });

    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'service_credits' });
    return NextResponse.json({ ok: false, code: SOCKET_RELAY_ERROR_CODE.persistenceUnavailable, message: 'Unable to send ServiceCredits.' }, { status: 503 });
  }
}
