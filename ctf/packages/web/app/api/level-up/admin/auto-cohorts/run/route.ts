import { NextResponse } from 'next/server';
import { runAutoCohortProposals } from 'lib/level-up/auto-cohort';
import { ensureMutationCsrf, levelUpErrorResponse, requireLevelUpAdminAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

// Admin "Refresh proposals" action (issue #904): re-read the Workforce gaps into the proposal queue now
// (force), behind the admin gate + CSRF. Also closes any expired auto cohort, same as the cron.
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
    const result = await runAutoCohortProposals({ source: 'admin', force: true });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'admin_auto_cohorts_run' });
    return levelUpErrorResponse(error, 'Proposal refresh unavailable.');
  }
}
