import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { createConnectionThread, insertFoundationAudit } from 'lib/foundation/repository';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type CreateThreadInput =
  | { ok: true; providerId: string; idempotencyKey: string }
  | { ok: false; response: NextResponse };

// Parse and validate the create-thread request body. providerId is required; idempotencyKey falls
// back to a deterministic per-provider key so the getOrCreate reuse path stays stable.
async function readCreateThreadInput(request: Request): Promise<CreateThreadInput> {
  let payload: { providerId?: string; idempotencyKey?: string } = {};
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

  const providerId = payload.providerId?.trim();
  if (!providerId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'providerId is required.' },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    providerId,
    idempotencyKey: payload.idempotencyKey?.trim() ?? `thread-${providerId}`,
  };
}

// Map a create-thread repository error to the matching HTTP response. Unknown errors are reported and
// surfaced as a 503.
function mapCreateThreadError(error: unknown): NextResponse {
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

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const input = await readCreateThreadInput(request);
  if (!input.ok) {
    return input.response;
  }

  try {
    const thread = await createConnectionThread({
      actorUserId: gate.auth.userId,
      actorDisplayName: gate.auth.username ?? gate.auth.userId,
      providerProfileId: input.providerId,
      idempotencyKey: input.idempotencyKey,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.thread.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'thread',
      targetId: thread.thread.id,
      metadata: { providerId: input.providerId, streamChannelId: thread.thread.streamChannelId },
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
    return mapCreateThreadError(error);
  }
}
