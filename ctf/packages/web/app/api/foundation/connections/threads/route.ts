import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { createConnectionThread, insertFoundationAudit } from 'lib/foundation/repository';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: { providerId?: string; idempotencyKey?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const providerId = payload.providerId?.trim();
  if (!providerId) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'providerId is required.' },
      { status: 400 },
    );
  }

  try {
    const thread = await createConnectionThread({
      actorUserId: gate.auth.userId,
      actorDisplayName: gate.auth.username ?? gate.auth.userId,
      providerProfileId: providerId,
      idempotencyKey: payload.idempotencyKey?.trim() ?? `thread-${providerId}`,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.thread.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'thread',
      targetId: thread.thread.id,
      metadata: { providerId, streamChannelId: thread.thread.streamChannelId },
    });

    // Notify the provider that someone started a connection with them — a durable record in the
    // notifications feed, deduped on the thread id so it fires once per connection (the getOrCreate
    // reuse never re-notifies). The live incoming-call ring stays Foundation's own real-time path;
    // this feed entry is the durable complement, not the ring.
    if (thread.thread.providerUserId && thread.thread.providerUserId !== gate.auth.userId) {
      await notifySafe({
        userId: thread.thread.providerUserId,
        sourcePlugin: 'foundation',
        notificationType: 'foundation.connection.started',
        category: 'safety',
        summary: 'Someone started a connection with you on Foundation.',
        linkPath: '/apps/foundation',
        targetRef: thread.thread.id,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        thread: thread.thread,
        streamApiKey: thread.streamApiKey,
        streamUserId: thread.streamUserId,
        streamToken: thread.streamToken,
      },
      { status: 201 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';

    if (code === 'provider_not_found') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.providerNotFound, message: 'Provider not found.' },
        { status: 404 },
      );
    }

    if (code === 'rate_limit_exceeded') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.rateLimitExceeded, message: 'Thread create rate limit exceeded.' },
        { status: 429 },
      );
    }

    if (code === 'policy_denied') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.policyDenied, message: 'Connection request denied by policy.' },
        { status: 403 },
      );
    }

    reportError(error, { area: 'foundation', op: 'connections_threads' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Thread create unavailable.' },
      { status: 503 },
    );
  }
}
