import { NextResponse } from 'next/server';
import { runAutoCohortCreation } from 'lib/level-up/auto-cohort';
import { ensureMutationCsrf, levelUpErrorResponse, requireLevelUpAdminAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

// Admin manual fallback for the auto-cohort run (issue #904). Same logic the daily cron calls, behind
// the admin gate + CSRF so an admin can trigger it on demand from the LevelUp admin screen.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLevelUpAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const result = await runAutoCohortCreation({ source: 'admin' });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'admin_auto_cohorts_run' });
    return levelUpErrorResponse(error, 'Auto-cohort run unavailable.');
  }
}
