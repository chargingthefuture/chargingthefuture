import { NextResponse } from 'next/server';
import { CHYME_DEFAULT_MESSAGES_LIMIT, CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { logChymeAudit } from 'lib/chyme/audit';
import { listRoomMessages, sendRoomMessage, validateMessageInput } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess, ensureMutationCsrf } from '../_lib';

function parseLimit(url: string): number {
  const queryLimit = new URL(url).searchParams.get('limit');
  if (!queryLimit) {
    return CHYME_DEFAULT_MESSAGES_LIMIT;
  }

  const parsed = Number.parseInt(queryLimit, 10);
  if (!Number.isFinite(parsed)) {
    return CHYME_DEFAULT_MESSAGES_LIMIT;
  }

  return parsed;
}

export async function GET(request: Request) {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const messages = await listRoomMessages(gate.identity, parseLimit(request.url));

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.messages.list',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {
        roomKey: 'chyme-main-room',
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(
      {
        roomKey: 'chyme-main-room',
        messages,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'messages_list', extra: { userId: gate.auth.userId } });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.messages.list',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {},
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to read Chyme messages.',
      },
      { status: 503 },
    );
  }
}

type MessageRequestBody = {
  text?: unknown;
};

export async function POST(request: Request) {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: MessageRequestBody;
  try {
    body = (await request.json()) as MessageRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.invalidPayload,
        message: 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const text = typeof body.text === 'string' ? body.text : '';
  const validation = validateMessageInput(text);
  if (!validation.valid) {
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.message.send',
      actorId: gate.auth.userId,
      status: 'deny',
      reason: 'empty_or_oversized_message',
      target: {
        roomKey: 'chyme-main-room',
      },
      result: 'failure',
      errorCategory: 'validation',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.invalidPayload,
        message: 'Message text must be 1 to 1000 characters after trimming.',
      },
      { status: 400 },
    );
  }

  try {
    const message = await sendRoomMessage(gate.identity, validation.normalizedText);

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.message.send',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {
        roomKey: 'chyme-main-room',
        messageId: message.id,
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'message_send', extra: { userId: gate.auth.userId } });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.message.send',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {
        roomKey: 'chyme-main-room',
      },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to send message.',
      },
      { status: 503 },
    );
  }
}
