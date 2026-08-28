import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { insertSkillsHuntAudit, rebuildLeaderboard } from 'lib/skills-hunt/repository';
import { recomputeMissionProgressForUser } from 'lib/skills-hunt/missions';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { withReason } from 'lib/errors/failure';

// The inverse of remove. Without it, removing a submission is a one-way door: the row stays in the
// admin list marked "Removed" and there is nothing an admin can do with it, which is the same dead
// end flag used to have. Restoring clears `deleted_at` and leaves the status exactly as it was, so
// a row that was flagged when it was removed comes back flagged and can then be un-flagged; the
// admin is never forced into a verdict to undo a removal.
//
// The derived state is recomputed the same way remove recomputes it, because the row counts again:
// an accepted submission's points return to the leaderboard, and its mission progress with them.
// The ServiceCredits ledger is untouched in both directions — remove does not reverse a reward, so
// restore does not re-mint one.
//
// One way this can fail. Removing a submission frees its Quora URL for a fresh nomination (the
// partial unique index skips soft-deleted rows), so by the time an admin restores it, someone may
// already have nominated that person again. Two live rows for one person is exactly what the index
// exists to prevent, so the restore is refused and says why rather than failing opaquely.
function isLiveSignatureCollision(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return message.includes('uq_skills_hunt_submissions_round_signature_live');
}

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
      const found = await client.query<{ round_id: string; submitter_user_id: string; status: string; deleted_at: Date | null }>(
        `SELECT round_id, submitter_user_id, status, deleted_at
           FROM skills_hunt_submissions
          WHERE id = $1::uuid
          FOR UPDATE`,
        [submissionId],
      );
      if (found.rowCount === 0) {
        throw new Error('skills_hunt_submission_not_found');
      }
      const row = found.rows[0];
      // Idempotent: a row that is not removed needs no further work.
      if (!row.deleted_at) {
        return { alreadyLive: true, roundId: row.round_id, status: row.status };
      }

      await client.query(
        `UPDATE skills_hunt_submissions SET deleted_at = NULL, updated_at = NOW() WHERE id = $1::uuid`,
        [submissionId],
      );
      // Recompute the derived state this row is part of again.
      await rebuildLeaderboard(client, row.round_id);
      await recomputeMissionProgressForUser(client, row.round_id, row.submitter_user_id);
      return { alreadyLive: false, roundId: row.round_id, status: row.status };
    });

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.restore',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'submission',
      targetId: submissionId,
      metadata: { alreadyLive: result.alreadyLive, restoredToStatus: result.status },
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
    if (isLiveSignatureCollision(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: SKILLS_HUNT_ERROR_CODE.duplicateSubmission,
          message: 'This person was nominated again after this submission was removed, so restoring it would leave two live nominations for the same person. Reject or remove the newer one first.',
        },
        { status: 409 },
      );
    }
    reportError(error, { area: 'skills-hunt', op: 'admin_submissions_submissionid_restore' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: withReason('Unable to restore submission', error) },
      { status: 503 },
    );
  }
}
