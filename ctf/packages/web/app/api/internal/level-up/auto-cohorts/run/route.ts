import { NextResponse } from 'next/server';
import { runAutoCohortProposals } from 'lib/level-up/auto-cohort';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Cron-only (issue #904): closes any expired auto cohort, and — at most every generation_interval_days
// (default 90) — re-reads the Workforce occupation gaps into the admin proposal queue. It does NOT
// create cohorts; an admin approves a proposal to open one. Guarded by CRON_SECRET (Bearer), matching
// the Unlock reward-reconciliation and PeerProgramming weekly-assignment convention. Safe to run more
// than once: the cadence guard and the pending-per-occupation unique index make repeats idempotent. The
// admin "Refresh proposals" action on the LevelUp admin screen forces a re-read on demand.
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
    const result = await runAutoCohortProposals({ source: 'cron' });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'internal_auto_cohorts_run' });
    return NextResponse.json(
      { ok: false, code: 'level_up_scheduler_unavailable', message: `Proposal run unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
