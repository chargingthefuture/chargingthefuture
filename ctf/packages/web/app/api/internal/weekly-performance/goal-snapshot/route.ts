import { NextRequest, NextResponse } from 'next/server';
import { captureCurrentWeekGoalSnapshots } from 'lib/weekly-performance/live-metrics';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { secretsMatch } from 'lib/auth/internal-secret';

// Internal, schedule-driven capture of the Weekly Performance goal snapshots (GDP Community Value
// Index toward 300B; Workforce recruited toward 2,000,000). Those are STATE metrics — past weeks
// cannot be recomputed — so each week needs at least one recorded reading. Opening the dashboard
// during the week records one, but goal history must never depend on someone visiting: the
// weekly-performance-goal-snapshot workflow calls this route on a schedule, and this route upserts
// the current week's snapshot rows (last capture of the week wins, so the stored value converges to
// the week's closing reading). A reading that was not stored answers 503 with the reason, so the
// workflow run goes red and the next day's run is a real safety net rather than a silent one.
//
// Guarded by INTERNAL_SERVICE_SECRET, the same posture as /api/internal/product-update — never
// callable by browsers or members.
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    // 503 (not 501): the route exists but is unconfigured in this runtime. 503 lets the caller
    // distinguish a misconfiguration from a wrong credential (401), matching the account/delete route.
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (!secretsMatch(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { weekStartDate, goals, failures } = await captureCurrentWeekGoalSnapshots();
    if (failures.length > 0) {
      const message = `Goal snapshot not stored for the week starting ${weekStartDate}: ${failures.join('; ')}`;
      reportError(new Error(message), { area: 'weekly-performance', op: 'internal_goal_snapshot' });
      return NextResponse.json(
        { ok: false, code: 'goal_snapshot_not_stored', message, weekStartDate, goals },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, weekStartDate, goals }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'weekly-performance', op: 'internal_goal_snapshot' });
    return NextResponse.json(
      { ok: false, code: 'goal_snapshot_failed', message: `Snapshot capture failed: ${failureReason(error)}` },
      { status: 500 },
    );
  }
}
