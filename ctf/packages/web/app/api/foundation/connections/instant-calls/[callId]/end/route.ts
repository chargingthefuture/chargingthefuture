import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { endInstantCall } from 'lib/foundation/instant-call';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

// End an instant 1:1 call (Foundation "Connect now", issue #808 task 3). Either participant may end it,
// from any non-terminal state: the caller can cancel a still-ringing call, and either party can hang up an
// in-progress call. Ending the session stops the call. Idempotent — ending an already-ended call returns
// the existing terminal state.
export async function POST(request: Request, context: { params: Promise<{ callId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { callId } = await context.params;
  if (!callId) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'callId is required.' },
      { status: 400 },
    );
  }

  try {
    const call = await endInstantCall({ callId, userId: gate.auth.userId });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.instant-call.end',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'call',
      targetId: callId,
      metadata: { endedByUserId: call.endedByUserId },
    });

    return NextResponse.json({ ok: true, call }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'call_not_found') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.callNotFound, message: 'Call not found or access denied.' },
        { status: 404 },
      );
    }
    reportError(error, { area: 'foundation', op: 'connections_instant_call_end' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not end the call.' },
      { status: 503 },
    );
  }
}
