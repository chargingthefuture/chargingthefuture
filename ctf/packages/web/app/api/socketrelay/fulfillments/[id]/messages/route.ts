import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { reportError } from 'lib/observability/report';
import { SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
import { listFulfillmentMessages, sendFulfillmentMessage, validateMessageInput } from 'lib/socketrelay/repository';

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
    reportError(error, { area: 'socketrelay', op: 'fulfillment_messages_list', extra: { userId: gate.auth.userId, fulfillmentId: id } });
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
  } catch {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const messageText = typeof body.messageText === 'string' ? body.messageText : '';
  const clientMessageId = typeof body.clientMessageId === 'string' && body.clientMessageId.trim().length > 0
    ? body.clientMessageId.trim()
    : `${gate.auth.userId}:${Date.now()}`;

  if (!validateMessageInput(messageText)) {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.prohibitedContent, message: 'Message rejected by moderation policy.' },
      { status: 400 },
    );
  }

  const { id } = await params;

  try {
    const item = await sendFulfillmentMessage(id, gate.auth.userId, gate.auth.isAdmin, messageText, clientMessageId);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'fulfillment_message_send', extra: { userId: gate.auth.userId, fulfillmentId: id } });
    return socketRelayErrorResponse(error, 'Message send unavailable.');
  }
}
