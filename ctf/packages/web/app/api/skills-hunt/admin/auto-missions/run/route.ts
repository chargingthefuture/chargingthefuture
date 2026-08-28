import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import { runAutoMissions } from 'lib/skills-hunt/auto-missions';
import { insertSkillsHuntAudit } from 'lib/skills-hunt/repository';
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

    // A durable row, not only a log line. An admin opening missions on demand changes what members
    // see and what they can earn, so it belongs in the trail an admin can read.
    const opened = result.rounds.reduce((sum, round) => sum + round.opened.length, 0);
    const updated = result.rounds.reduce((sum, round) => sum + round.updated, 0);
    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.mission.auto_generate',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'auto_mission_run',
      targetId: result.ranAtIso,
      metadata: { source: 'admin', skipped: result.skipped ?? null, rounds: result.rounds.length, opened, updated },
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_auto_missions_run' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to run auto missions: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
