import { NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { getThreadCredentialsForParticipant, insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

// Re-open the Direct Line for an existing Foundation connection thread. The chat channel is created
// at Request-Quote time; this GET hands the member fresh Stream credentials so the web UI can connect
// to that already-existing channel. It only succeeds when the caller is a participant of the thread.
export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { threadId } = await context.params;
  if (!threadId) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'threadId is required.' },
      { status: 400 },
    );
  }

  try {
    const credentials = await getThreadCredentialsForParticipant({
      threadId,
      actorUserId: gate.auth.userId,
      actorDisplayName: gate.auth.username ?? gate.auth.userId,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.thread.token.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'thread',
      targetId: threadId,
      metadata: { streamChannelId: credentials.streamChannelId },
    });

    return NextResponse.json(
      {
        ok: true,
        streamApiKey: credentials.streamApiKey,
        streamUserId: credentials.streamUserId,
        streamToken: credentials.streamToken,
        streamChannelId: credentials.streamChannelId,
      },
      { status: 200 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';

    // The caller is not a participant of this thread (or it does not exist). Return 404 so a
    // non-participant cannot tell an existing thread apart from a missing one.
    if (code === 'thread_not_found') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.notThreadParticipant, message: 'Thread not found or access denied.' },
        { status: 404 },
      );
    }

    if (code === 'stream_unavailable') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.streamUnavailable, message: 'Direct Line is temporarily unavailable.' },
        { status: 503 },
      );
    }

    reportError(error, { area: 'foundation', op: 'connections_threads_threadid_token' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Direct Line token unavailable.' },
      { status: 503 },
    );
  }
}
