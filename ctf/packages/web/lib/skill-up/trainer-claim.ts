// Claiming a cohort to train, and the skill audit that keeps it honest.
//
// Owner decision (2026-08-29). Nobody approves trainers by hand any more. A person may claim a
// cohort if their CLAIMED Directory profile carries at least one skill belonging to the occupation
// that cohort trains. That is a join, not a judgment: every Skills Taxonomy skill belongs to exactly
// one job title, and a cohort stores the job title it trains, so the check has no discretion in it
// and therefore no bias — and no queue for the owner to work through.
//
// Removing the human also removes the thing a human would have noticed, so the claim is paired with
// `skill_up_trainer_skill_audit`: every skill added to or removed from a claimed Directory profile
// is recorded, whether or not that person is a trainer yet. The fraud this exists to catch is
// add-skill / claim-cohort / remove-skill, and its first step happens before the person has claimed
// anything at all.
import type { PoolClient } from 'pg';
import { queryDb } from 'lib/db/postgres';
import { insertSkillUpAudit } from 'lib/skill-up/repository';
import { SKILL_UP_AUTO_COHORT_ACTOR_ID } from 'lib/skill-up/constants';

export type TrainerSkillChange = {
  userId: string;
  profileId: string;
  skillId: string;
  skillName: string;
  jobTitleId: string | null;
  action: 'added' | 'removed';
  changeSource: 'profile_edit' | 'profile_unclaimed' | 'profile_deleted';
};

/**
 * Append skill changes to the trainer audit. Called from Directory's profile-skill write path via
 * lib/shared/skill-up-interface.ts.
 *
 * `client` is the caller's open transaction, and passing it is the point: the audit row lands in the
 * same commit as the skill change it describes, so the log cannot quietly miss an edit. A log with
 * silent gaps is worse than a loud failure when the log exists to catch someone covering their
 * tracks. Without a client it opens its own connection, for callers not already in a transaction.
 */
export async function recordTrainerSkillChanges(changes: TrainerSkillChange[], client?: PoolClient): Promise<void> {
  if (changes.length === 0) {
    return;
  }

  const run = client
    ? (text: string, values: unknown[]) => client.query(text, values)
    : (text: string, values: unknown[]) => queryDb(text, values);

  for (const change of changes) {
    await run(
      `INSERT INTO skill_up_trainer_skill_audit
         (user_id, profile_id, skill_id, skill_name, job_title_id, action, change_source)
       VALUES ($1, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7)`,
      [
        change.userId,
        change.profileId,
        change.skillId,
        change.skillName,
        change.jobTitleId,
        change.action,
        change.changeSource,
      ],
    );
  }
}

export type ClaimIneligibleReason = 'cohort_has_no_occupation' | 'no_claimed_profile' | 'no_matching_skill';

export type ClaimEligibility =
  | { eligible: true; matchedSkillIds: string[] }
  | { eligible: false; reason: ClaimIneligibleReason };

/**
 * Can this person train this cohort? True when their claimed Directory profile holds at least one
 * skill under the cohort's occupation.
 *
 * A cohort with no `job_title_id` is refused rather than waved through: without an occupation there
 * is nothing to match against, and letting it pass would make the unclaimable case the open one.
 */
export async function checkTrainerClaimEligibility(input: {
  cohortId: string;
  userId: string;
}): Promise<ClaimEligibility> {
  const cohort = await queryDb<{ job_title_id: string | null }>(
    `SELECT job_title_id::text AS job_title_id FROM skill_up_cohorts WHERE id = $1::uuid LIMIT 1`,
    [input.cohortId],
  );
  const jobTitleId = cohort.rows[0]?.job_title_id ?? null;
  if (!jobTitleId) {
    return { eligible: false, reason: 'cohort_has_no_occupation' };
  }

  const profile = await queryDb<{ id: string }>(
    `SELECT id::text AS id FROM directory_profiles WHERE claimed_by_user_id = $1 LIMIT 1`,
    [input.userId],
  );
  if (!profile.rows[0]) {
    return { eligible: false, reason: 'no_claimed_profile' };
  }

  // Every taxonomy skill belongs to exactly one job title, so this is an exact match — no fuzzy
  // title comparison and no scoring.
  const matches = await queryDb<{ skill_id: string }>(
    `SELECT s.id::text AS skill_id
       FROM directory_profile_skills ps
       JOIN skills_taxonomy_skills s ON s.id = ps.skill_id
      WHERE ps.profile_id = $1::uuid
        AND s.job_title_id = $2::uuid
        AND s.is_active = TRUE`,
    [profile.rows[0].id, jobTitleId],
  );

  if (matches.rows.length === 0) {
    return { eligible: false, reason: 'no_matching_skill' };
  }
  return { eligible: true, matchedSkillIds: matches.rows.map((row) => row.skill_id) };
}

export type ClaimOutcome =
  | { status: 'claimed'; cohortId: string }
  | { status: 'not_found' }
  | { status: 'already_claimed' }
  | { status: 'not_eligible'; reason: ClaimIneligibleReason };

/**
 * A person claims a cohort that has no trainer yet, becoming its trainer of record. The cohort's
 * creator is the trainer of record in this plugin (`isTrainerForCohort` checks created_by_user_id),
 * so claiming replaces the placeholder id with theirs.
 *
 * Any cohort with no human trainer can be claimed, not only the ones the retired auto-cohort run
 * opened: claiming is now how a trainer attaches to a cohort at all.
 */
export async function claimCohortAsTrainer(input: {
  cohortId: string;
  trainerUserId: string;
}): Promise<ClaimOutcome> {
  const current = await queryDb<{ created_by_user_id: string; status: string }>(
    `SELECT created_by_user_id, status FROM skill_up_cohorts WHERE id = $1::uuid LIMIT 1`,
    [input.cohortId],
  );
  const row = current.rows[0];
  if (!row) {
    return { status: 'not_found' };
  }
  if (row.created_by_user_id !== SKILL_UP_AUTO_COHORT_ACTOR_ID) {
    return { status: 'already_claimed' };
  }

  const eligibility = await checkTrainerClaimEligibility({ cohortId: input.cohortId, userId: input.trainerUserId });
  if (!eligibility.eligible) {
    return { status: 'not_eligible', reason: eligibility.reason };
  }

  await queryDb(
    `UPDATE skill_up_cohorts
     SET created_by_user_id = $2, updated_at = NOW()
     WHERE id = $1::uuid AND created_by_user_id = $3`,
    [input.cohortId, input.trainerUserId, SKILL_UP_AUTO_COHORT_ACTOR_ID],
  );

  // Backfill the trainer of record onto enrollments written while the cohort had none. Without this
  // their milestone releases would have no trainer to grant to. Only rows not already assigned.
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
    metadata: {
      claimedFrom: SKILL_UP_AUTO_COHORT_ACTOR_ID,
      matchedSkillIds: eligibility.matchedSkillIds,
      targetContext: { cohortId: input.cohortId },
    },
  });

  return { status: 'claimed', cohortId: input.cohortId };
}
