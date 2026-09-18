import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { recomputeMissionProgressForRound } from 'lib/skills-hunt/missions';
import { insertSkillsHuntAudit } from 'lib/skills-hunt/repository';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin-only manual recompute of every scout's mission progress in one round.
//
// Progress counts are otherwise only recomputed as a side effect of reviewing a nomination, which
// is enough while a mission's goal never changes. It is not enough after an admin corrects one:
// re-pointing a mission at a different goal leaves every stored count at its old value until
// somebody's next nomination happens to be accepted in that round, so a member keeps reading a
// number the mission no longer means. Same shape as the manual leaderboard rebuild next door.
export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { roundId } = await params;

  try {
    const { scoutsRecomputed } = await withDbTransaction((client) =>
      recomputeMissionProgressForRound(client, roundId),
    );

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.mission.progress.recompute',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'round',
      targetId: roundId,
      metadata: { scoutsRecomputed },
    });

    return NextResponse.json({ ok: true, scoutsRecomputed }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_missions_recompute' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to recompute mission progress: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
