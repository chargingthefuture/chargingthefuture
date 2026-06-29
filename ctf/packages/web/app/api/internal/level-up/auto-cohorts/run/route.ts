import { NextResponse } from 'next/server';
import { runAutoCohortCreation } from 'lib/level-up/auto-cohort';
import { reportError } from 'lib/observability/report';

// Cron-only: reads the Workforce occupation gaps and stands up LevelUp cohorts for the largest of them
// (issue #904), without an admin hand-building each cohort. Guarded by CRON_SECRET (Bearer), matching
// the Unlock reward-reconciliation and PeerProgramming weekly-assignment convention. Safe to run more
// than once: a partial unique index and an already-covered check mean a repeat run can never duplicate
// a cohort for the same occupation. The admin "Run now" action on the LevelUp admin screen is the
// manual fallback.
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, code: 'level_up_scheduler_forbidden', message: 'Invalid cron secret.' },
      { status: 403 },
    );
  }

  try {
    const result = await runAutoCohortCreation({ source: 'cron' });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'internal_auto_cohorts_run' });
    return NextResponse.json(
      { ok: false, code: 'level_up_scheduler_unavailable', message: 'Auto-cohort run unavailable.' },
      { status: 503 },
    );
  }
}
