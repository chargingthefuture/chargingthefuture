import { NextRequest, NextResponse } from 'next/server';
import { GOAL_METRIC_KEYS, computeLiveWeekMetrics, currentWeekStart } from 'lib/weekly-performance/live-metrics';
import { reportError } from 'lib/observability/report';

// Internal, schedule-driven capture of the Weekly Performance goal snapshots (GDP Community Value
// Index toward 300B; Workforce recruited toward 2,000,000). Those are STATE metrics — past weeks
// cannot be recomputed — so each week needs at least one recorded reading. Opening the dashboard
// during the week records one, but goal history must never depend on someone visiting: the
// weekly-performance-goal-snapshot workflow calls this route on a schedule, and computing the
// current week's metrics upserts that week's snapshot rows as a side effect (last capture of the
// week wins, so the stored value converges to the week's closing reading).
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
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const weekStartDate = currentWeekStart();
    const metrics = await computeLiveWeekMetrics(weekStartDate);
    const goals = metrics
      .filter((m) => (GOAL_METRIC_KEYS as readonly string[]).includes(m.metricKey))
      .map((m) => ({ metricKey: m.metricKey, metricValue: m.metricValue }));
    return NextResponse.json({ ok: true, weekStartDate, goals }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'weekly-performance', op: 'internal_goal_snapshot' });
    return NextResponse.json({ error: 'Snapshot capture failed' }, { status: 500 });
  }
}
