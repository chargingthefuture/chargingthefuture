import { NextResponse } from 'next/server';
import { requireUnlockUserAccess, resolveUnlockRequestId } from 'lib/unlock/_lib';
import { getUnlockStatusForUser, insertUnlockAudit } from 'lib/unlock/repository';
import { isUnlockEarlyCommonsEnabled } from 'lib/unlock/access';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  try {
    const baseStatus = await getUnlockStatusForUser(gate.auth.userId);
    // A/B experiment bucket — resolved here (not in the repository) so the UI can offer the Commons
    // help link to the treatment group. Defaults to false (control) when the rollout is off.
    const earlyCommonsAccess = await isUnlockEarlyCommonsEnabled(gate.auth.userId);
    const status = { ...baseStatus, earlyCommonsAccess };

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
        // Recorded so the experiment's effect on completion rate can be measured per bucket.
        experimentBucket: earlyCommonsAccess ? 'early_commons' : 'control',
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
