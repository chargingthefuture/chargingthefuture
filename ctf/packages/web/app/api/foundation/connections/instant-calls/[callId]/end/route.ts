import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { endInstantCall } from 'lib/foundation/instant-call';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { failureResponse } from 'lib/errors/failure';

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
    // Unrecognized: a real failure of a step in this route. The member keeps plain copy, and the
    // response carries a reference that also appears in the error report, so a screenshot of the
    // banner can be matched to the log line that says what broke (rule 137 points 2 and 4).
    return failureResponse({
      summary: 'Could not end the call right now.',
      error,
      code: FOUNDATION_ERROR_CODE.persistenceUnavailable,
      area: 'foundation',
      op: 'connections_instant_call_end',
      audience: 'member',
    });
  }
}
