import { NextResponse } from 'next/server';
import { requireUnlockUserAccess } from 'lib/unlock/_lib';
import { getUnlockStanding } from 'lib/unlock/standing';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// GET /api/unlock/standing: where the signed-in member stands with Unlock in 3.1 (approved or not,
// the day count, whether posting is paused), for the banner on every 3.1 screen. Any signed-in
// member, the same gate as the rest of the Unlock flow.

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  try {
    const standing = await getUnlockStanding(gate.auth.userId);
    return NextResponse.json({ ok: true, standing }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'standing' });
    return NextResponse.json(
      { ok: false, code: 'UNLOCK_STANDING_UNAVAILABLE', message: 'Could not read your Unlock standing.', reason: failureReason(error) },
      { status: 503 },
    );
  }
}
