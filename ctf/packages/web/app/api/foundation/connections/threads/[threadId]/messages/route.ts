import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit, sendMessageToThread } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type SendMessageInput =
  | { ok: true; messageText: string; clientMessageId: string; attachments: unknown }
  | { ok: false; response: NextResponse };

// Parse and validate the send-message request body against the route's threadId. threadId, a
// non-empty messageText, and a clientMessageId are all required.
async function readSendMessageInput(request: Request, threadId: string): Promise<SendMessageInput> {
  let payload: { messageText?: string; attachments?: unknown; clientMessageId?: string } = {};
  try {
    payload = await request.json();
  } catch (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.', reason: failureReason(error) },
        { status: 400 },
      ),
    };
  }

  const messageText = payload.messageText?.trim() ?? '';
  const clientMessageId = payload.clientMessageId?.trim() ?? '';

  if (!threadId || !messageText || !clientMessageId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'threadId, messageText, and clientMessageId are required.' },
        { status: 400 },
      ),
    };
  }

  return { ok: true, messageText, clientMessageId, attachments: payload.attachments };
}

// Map a send-message repository error to the matching HTTP response. Unknown errors are reported and
// surfaced as a 503.
function mapSendMessageError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : '';

  if (code === 'thread_not_found') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.threadNotFound, message: 'Thread not found or access denied.' },
      { status: 404 },
    );
  }

  if (code === 'rate_limit_exceeded') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.rateLimitExceeded, message: 'Message rate limit exceeded.' },
      { status: 429 },
    );
  }

  reportError(error, { area: 'foundation', op: 'connections_threads_threadid_messages' });
  return NextResponse.json(
    { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Message send unavailable.' },
    { status: 503 },
  );
}

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { threadId } = await context.params;

  const input = await readSendMessageInput(request, threadId);
  if (!input.ok) {
    return input.response;
  }

  try {
    const message = await sendMessageToThread({
      threadId,
      actorUserId: gate.auth.userId,
      actorDisplayName: gate.auth.username ?? gate.auth.userId,
      messageText: input.messageText,
      attachments: input.attachments,
      clientMessageId: input.clientMessageId,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.message.send',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'thread',
      targetId: threadId,
      metadata: { messageId: message.id },
    });

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    return mapSendMessageError(error);
  }
}
