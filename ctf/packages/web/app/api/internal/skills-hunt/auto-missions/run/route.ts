import { NextResponse } from 'next/server';
import { runAutoMissions } from 'lib/skills-hunt/auto-missions';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Cron-only: tops up every active SkillsHunt round with missions for the sectors Workforce shows
// the largest talent gaps in (weekly schedule, .github/workflows/skills-hunt-auto-missions.yml).
// Guarded by CRON_SECRET (Bearer), matching the SkillUp auto-cohort / Unlock reward-reconciliation
// convention. Safe to run more than once: at most one non-archived auto mission per (round,
// sector), enforced in the database. The admin "Run now" action on the SkillsHunt admin missions
// tab forces the same run on demand.
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
      { ok: false, code: 'skills_hunt_scheduler_forbidden', message: 'Invalid cron secret.' },
      { status: 403 },
    );
  }

  try {
    const result = await runAutoMissions({ source: 'cron' });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'internal_auto_missions_run' });
    return NextResponse.json(
      { ok: false, code: 'skills_hunt_scheduler_unavailable', message: `Auto-mission run unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
