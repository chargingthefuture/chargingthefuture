import { NextResponse } from 'next/server';
import { requireUnlockUserAccess } from 'lib/unlock/_lib';
import { getUnlockStatusForUser, insertUnlockAudit } from 'lib/unlock/repository';

export async function GET() {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const status = await getUnlockStatusForUser(gate.auth.userId);

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.status.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: gate.auth.userId,
      metadata: {
        accessTier: status.accessTier,
        reviewStatus: status.reviewStatus,
      },
    });

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    // Surface the real cause in server logs (a swallowed error here made the 503
    // undiagnosable). The client message stays generic so DB internals never leak.
    console.error('[unlock] status query failed', error);
    return NextResponse.json({ ok: false, message: 'Unlock status unavailable.' }, { status: 503 });
  }
}
