import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import { insertSocketRelayAudit, listFulfillmentMessages, sendFulfillmentMessage, validateMessageInput } from 'lib/socket-relay/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await params;

  try {
    const items = await listFulfillmentMessages(id, gate.auth.userId, gate.auth.isAdmin);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'fulfillments_id_messages' });
    return socketRelayErrorResponse(error, 'Fulfillment messages unavailable.');
  }
}

export async function POST(request: Request, { params }: RouteProps) {
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const messageText = typeof body.messageText === 'string' ? body.messageText : '';
  const clientMessageId = typeof body.clientMessageId === 'string' && body.clientMessageId.trim().length > 0
    ? body.clientMessageId.trim()
    : `${gate.auth.userId}:${Date.now()}`;

  if (!validateMessageInput(messageText)) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.prohibitedContent, message: 'Message rejected by moderation policy.' },
      { status: 400 },
    );
  }

  const { id } = await params;

  try {
    const item = await sendFulfillmentMessage(id, gate.auth.userId, gate.auth.isAdmin, messageText, clientMessageId);
    // Record the evidence the audit contract asks for: reaching this point means the participant
    // membership check (in sendFulfillmentMessage) and the moderation gate (validateMessageInput,
    // above) both passed.
    await insertSocketRelayAudit({
      actorId: gate.auth.userId,
      command: 'socket-relay.fulfillment.message.send',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'fulfillment',
      targetId: id,
      metadata: {
        messageId: item.id,
        moderationStatus: item.moderationStatus,
        participantMembershipCheck: 'pass',
        moderationCheck: 'pass',
      },
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'fulfillments_id_messages' });
    return socketRelayErrorResponse(error, 'Message send unavailable.');
  }
}
