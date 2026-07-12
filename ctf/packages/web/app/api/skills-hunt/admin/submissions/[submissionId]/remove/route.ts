import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { insertSkillsHuntAudit, rebuildLeaderboard } from 'lib/skills-hunt/repository';
import { recomputeMissionProgressForUser } from 'lib/skills-hunt/missions';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';

// Admin-only soft-delete of a submission. This is the right way to void a
// submission that should never have counted — a duplicate, spam, or a test row —
// WITHOUT it registering as a scout "rejection". All the derived-state queries
// (reputation/rate-limit, leaderboard, mission progress, My Finds, directory
// eligibility) filter `deleted_at IS NULL`, so a soft-deleted row simply
// disappears from them; in particular it does not raise the scout's rejection
// rate the way a `reject` review does.
//
// It does NOT touch the ServiceCredits ledger: if an accepted submission had a
// reward, reverse it separately via the ServiceCredits admin burn (the mint is
// mirrored to the external ledger and cannot be undone with a status change).
export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { submissionId } = await params;

  try {
    const result = await withDbTransaction(async (client) => {
      const found = await client.query<{ round_id: string; submitter_user_id: string; deleted_at: Date | null }>(
        `SELECT round_id, submitter_user_id, deleted_at
           FROM skills_hunt_submissions
          WHERE id = $1::uuid
          FOR UPDATE`,
        [submissionId],
      );
      if (found.rowCount === 0) {
        throw new Error('skills_hunt_submission_not_found');
      }
      const row = found.rows[0];
      // Idempotent: an already-removed row needs no further work.
      if (row.deleted_at) {
        return { alreadyRemoved: true, roundId: row.round_id };
      }

      await client.query(
        `UPDATE skills_hunt_submissions SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
        [submissionId],
      );
      // Recompute the derived state that excluded this row is now gone from.
      await rebuildLeaderboard(client, row.round_id);
      await recomputeMissionProgressForUser(client, row.round_id, row.submitter_user_id);
      return { alreadyRemoved: false, roundId: row.round_id };
    });

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.remove',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'submission',
      targetId: submissionId,
      metadata: { alreadyRemoved: result.alreadyRemoved },
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    if (message === 'skills_hunt_submission_not_found') {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Submission not found.' },
        { status: 404 },
      );
    }
    reportError(error, { area: 'skills-hunt', op: 'admin_submissions_submissionid_remove' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to remove submission.' },
      { status: 503 },
    );
  }
}
