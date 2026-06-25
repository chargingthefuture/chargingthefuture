import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { declineInstantCall } from 'lib/foundation/instant-call';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

// Decline a ringing instant 1:1 call (Foundation "Connect now", issue #808 task 3). Only the callee may
// decline, and only while it is still ringing. Terminal — the ring ends with no call and no charge.
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
    const call = await declineInstantCall({ callId, calleeUserId: gate.auth.userId });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.instant-call.decline',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'call',
      targetId: callId,
      metadata: { callerUserId: call.callerUserId },
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
    if (code === 'not_callee') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.callNotCallee, message: 'Only the person being called can decline.' },
        { status: 403 },
      );
    }
    if (code === 'not_ringing') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.callNotRinging, message: 'This call is no longer ringing.' },
        { status: 409 },
      );
    }
    reportError(error, { area: 'foundation', op: 'connections_instant_call_decline' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not decline the call.' },
      { status: 503 },
    );
  }
}
