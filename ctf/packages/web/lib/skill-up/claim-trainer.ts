// Claiming an auto-created cohort (issue #904).
//
// SkillUp used to stand up cohorts on its own: a scheduled run read the Workforce talent gaps and
// wrote a ranked proposal queue for an admin to approve. That generation half was removed on
// 2026-08-29 (owner decision: redundant — admins open cohorts directly in the SkillUp shell). The
// cohorts it already opened are live and members are enrolled in them, so the one piece that
// outlives it stays: a cohort created by the scheduler carries the scheduler's placeholder id as its
// creator, and a trainer claims it to become its trainer of record.
import { queryDb } from 'lib/db/postgres';
import { insertSkillUpAudit } from 'lib/skill-up/repository';
import { SKILL_UP_AUTO_COHORT_ACTOR_ID } from 'lib/skill-up/constants';

/**
 * A trainer (or admin) claims an auto-created cohort that still has no human trainer. The cohort's
 * creator is the trainer of record in this plugin (`isTrainerForCohort` checks created_by_user_id),
 * so claiming replaces the scheduler id with the trainer's id.
 */
export async function claimAutoCohortTrainer(input: { cohortId: string; trainerUserId: string }): Promise<'claimed' | 'not_found' | 'already_claimed'> {
  const current = await queryDb<{ created_by_user_id: string; auto_created: boolean; status: string }>(
    `SELECT created_by_user_id, auto_created, status FROM skill_up_cohorts WHERE id = $1::uuid LIMIT 1`,
    [input.cohortId],
  );
  const row = current.rows[0];
  if (!row || !row.auto_created) {
    return 'not_found';
  }
  if (row.created_by_user_id !== SKILL_UP_AUTO_COHORT_ACTOR_ID) {
    return 'already_claimed';
  }

  await queryDb(
    `UPDATE skill_up_cohorts
     SET created_by_user_id = $2, updated_at = NOW()
     WHERE id = $1::uuid AND created_by_user_id = $3`,
    [input.cohortId, input.trainerUserId, SKILL_UP_AUTO_COHORT_ACTOR_ID],
  );

  // Backfill the trainer of record onto any enrollments that were created while the cohort still had
  // no trainer (members can enroll in an open auto cohort before it is claimed). Without this their
  // milestone-release payouts would have no trainer to pay. Only fill rows not already assigned.
  await queryDb(
    `UPDATE skill_up_enrollments
     SET assigned_trainer_id = $2, updated_at = NOW()
     WHERE cohort_id = $1::uuid AND assigned_trainer_id IS NULL`,
    [input.cohortId, input.trainerUserId],
  );

  await insertSkillUpAudit({
    actorId: input.trainerUserId,
    command: 'skill-up.cohort.claim_trainer',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'cohort',
    targetId: input.cohortId,
    // Structured target context per the cohort.claim_trainer audit contract, which requires
    // cohortId in targetContext. (workspaceId is a contract placeholder with no value in this
    // single-tenant codebase, so it is omitted, consistent with the admin.adjust_credits audit.)
    metadata: { claimedFrom: SKILL_UP_AUTO_COHORT_ACTOR_ID, targetContext: { cohortId: input.cohortId } },
  });

  return 'claimed';
}
