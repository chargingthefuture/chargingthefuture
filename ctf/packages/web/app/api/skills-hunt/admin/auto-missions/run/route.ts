import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import { runAutoMissions } from 'lib/skills-hunt/auto-missions';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin "Run now": the on-demand version of the weekly cron — opens Workforce gap missions for
// every active round, respecting the same cap and idempotency guards.
export async function POST(request: Request) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const result = await runAutoMissions({ source: 'admin' });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_auto_missions_run' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to run auto missions: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
