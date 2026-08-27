import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { insertSkillsHuntAudit, rebuildLeaderboard } from 'lib/skills-hunt/repository';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin-only manual leaderboard rebuild. The leaderboard is a cached table that
// the app only recomputes as a side effect of reviewing a submission, so there
// is otherwise no way to refresh it after an out-of-band change (e.g. a data fix
// that rejected an already-accepted submission). This recomputes the scout
// board for the round from the current accepted rows.
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
    await withDbTransaction((client) => rebuildLeaderboard(client, roundId));

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.leaderboard.rebuild',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'round',
      targetId: roundId,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_leaderboard_rebuild' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to rebuild leaderboard: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
