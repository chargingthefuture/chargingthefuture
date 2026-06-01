import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit, sendMessageToThread } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

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

  let payload: { messageText?: string; attachments?: unknown; clientMessageId?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const messageText = payload.messageText?.trim() ?? '';
  const clientMessageId = payload.clientMessageId?.trim() ?? '';

  if (!threadId || !messageText || !clientMessageId) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'threadId, messageText, and clientMessageId are required.' },
      { status: 400 },
    );
  }

  try {
    const message = await sendMessageToThread({
      threadId,
      actorUserId: gate.auth.userId,
      actorDisplayName: gate.auth.username ?? gate.auth.userId,
      messageText,
      attachments: payload.attachments,
      clientMessageId,
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

    reportError(error, { area: 'foundation', op: 'connection_message_send', extra: { userId: gate.auth.userId, threadId } });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Message send unavailable.' },
      { status: 503 },
    );
  }
}
