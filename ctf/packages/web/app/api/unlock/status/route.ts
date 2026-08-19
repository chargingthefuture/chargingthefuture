import { NextResponse } from 'next/server';
import { requireUnlockUserAccess, resolveUnlockRequestId } from 'lib/unlock/_lib';
import { getUnlockStatusForUser, insertUnlockAudit } from 'lib/unlock/repository';
import { hasUnlockCommonsAccessWithoutSubmission } from 'lib/unlock/help-requests';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  try {
    const baseStatus = await getUnlockStatusForUser(gate.auth.userId);
    // Whether this member may enter the Commons without a submission — they asked for help, or they
    // have been here on an earlier day. Resolved here rather than in the repository so `accessTier`
    // keeps meaning strictly "what the submission says". The mobile app gates its Unlock wall on it.
    const commonsAccess = baseStatus.hasSubmission
      ? false
      : await hasUnlockCommonsAccessWithoutSubmission(gate.auth.userId);
    const status = { ...baseStatus, commonsAccess };

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.status.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: gate.auth.userId,
      requestId,
      metadata: {
        accessTier: status.accessTier,
        reviewStatus: status.reviewStatus,
        commonsAccess: status.commonsAccess,
      },
    });

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'status' });
    // Surface the real cause in server logs (a swallowed error here made the 503
    // undiagnosable). The client message stays generic so DB internals never leak.
    console.error('[unlock] status query failed', error);
    return NextResponse.json({ ok: false, message: 'Unlock status unavailable.' }, { status: 503 });
  }
}
