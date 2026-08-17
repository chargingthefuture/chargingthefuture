import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_CALL_MODALITIES, FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { createCallSession, insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type CreateCallInput =
  | { ok: true; modality: 'voice' | 'video'; requestedDurationMinutes?: number; idempotencyKey: string }
  | { ok: false; response: NextResponse };

// Parse and validate the create-call-session request body against the route's threadId. modality is
// required and must be one of the supported values; idempotencyKey falls back to a deterministic key.
async function readCreateCallInput(request: Request, threadId: string): Promise<CreateCallInput> {
  let payload: { modality?: string; requestedDurationMinutes?: number; idempotencyKey?: string } = {};
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

  const modality = payload.modality?.trim() ?? '';
  if (!threadId || !FOUNDATION_CALL_MODALITIES.includes(modality as 'voice' | 'video')) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'threadId and modality (voice|video) are required.' },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    modality: modality as 'voice' | 'video',
    requestedDurationMinutes: payload.requestedDurationMinutes,
    idempotencyKey: payload.idempotencyKey?.trim() ?? `${threadId}:${modality}`,
  };
}

// Map a create-call-session repository error to the matching HTTP response. Unknown errors are
// reported and surfaced as a 503.
function mapCreateCallError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : '';

  if (code === 'thread_not_found') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.threadNotFound, message: 'Thread not found or access denied.' },
      { status: 404 },
    );
  }

  if (code === 'policy_denied') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.policyDenied, message: 'Call session denied by capacity policy.' },
      { status: 403 },
    );
  }

  reportError(error, { area: 'foundation', op: 'connections_threads_threadid_calls' });
  return NextResponse.json(
    { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Call session unavailable.' },
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

  const input = await readCreateCallInput(request, threadId);
  if (!input.ok) {
    return input.response;
  }

  try {
    const session = await createCallSession({
      threadId,
      actorUserId: gate.auth.userId,
      actorDisplayName: gate.auth.username ?? gate.auth.userId,
      modality: input.modality,
      requestedDurationMinutes: input.requestedDurationMinutes,
      idempotencyKey: input.idempotencyKey,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.call.session.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'thread',
      targetId: threadId,
      metadata: { callSessionId: session.callSession.id, modality: input.modality },
    });

    return NextResponse.json({ ok: true, ...session }, { status: 201 });
  } catch (error) {
    return mapCreateCallError(error);
  }
}
