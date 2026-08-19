import { NextResponse } from 'next/server';
import { requireUnlockUserAccess, resolveUnlockRequestId } from 'lib/unlock/_lib';
import { getUnlockStatusForUser, insertUnlockAudit } from 'lib/unlock/repository';
import { getUnlockAccessTier } from 'lib/unlock/access';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  try {
    const baseStatus = await getUnlockStatusForUser(gate.auth.userId);
    // Whether this member may enter the Commons. Resolved through the same gate the server uses, so
    // the mobile wall and the web routing can never disagree about it — reading it any other way is
    // how a member ends up bounced back to the Unlock screen by a button that said it would let them
    // in. `accessTier` above still means strictly "what the submission says"; this is the effective
    // answer, which for a waiting or unsubmitted member who asked for help is more generous.
    const effectiveTier = await getUnlockAccessTier(gate.auth.userId).catch(() => null);
    const commonsAccess = effectiveTier === 'approved_full' || effectiveTier === 'locked_support_only';
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
