import { NextResponse } from 'next/server';
import { requireSocketRelayReadAccess, ensureMutationCsrf } from 'lib/socket-relay/_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { insertSocketRelayAudit } from 'lib/socket-relay/repository';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type SocketRelayServiceCreditsSendInput = {
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

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let input: SocketRelayServiceCreditsSendInput;
  try {
    input = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON.', reason: failureReason(error) }, { status: 400 });
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

    // Audit the financial mutation at the SocketRelay boundary. The canonical ledger lives in the
    // ServiceCredits plugin, but this route initiates the transfer, so it records who sent how much to
    // whom from here — matching the plugin's other member mutations and the command contract.
    await insertSocketRelayAudit({
      actorId: gate.auth.userId,
      command: 'socket-relay.service-credits.send',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'service_credits_transfer',
      targetId: input.toUserId,
      // Evidence fields the audit contract asks for. Reaching this point proves the amount passed the
      // positive-number check above, so record it as passed alongside the recipient/amount/key context.
      metadata: { recipientUserId: input.toUserId, amount: input.amount, idempotencyKey, amountPositiveCheck: 'pass' },
    });

    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'service_credits' });
    return NextResponse.json({ ok: false, code: SOCKET_RELAY_ERROR_CODE.persistenceUnavailable, message: 'Unable to send ServiceCredits.' }, { status: 503 });
  }
}
