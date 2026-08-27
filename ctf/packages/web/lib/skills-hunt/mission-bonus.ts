// Mission completion bonus — the ServiceCredits side of finishing a mission.
//
// The mission spec (continuity §2.9) always said completing a mission writes "a service-credits
// ledger entry of the mission's bonus_points", and the completion notification has been telling
// members they earned that bonus since the feature shipped. Nothing paid it: `bonus_credited_at`
// was declared, selected and mapped, but never written. This module closes that gap.
//
// Shape of the settlement, mirroring the accept reward in the review route:
//   - It runs AFTER the review transaction commits, as a best-effort follow-up. A ledger outage is
//     reported and swallowed — it must never undo a moderation decision.
//   - Claim then mint: `bonus_credited_at` is stamped under a guard that only fires while it is
//     still NULL, so two concurrent reviews cannot both pay the same completion, and the ledger's
//     own idempotency key is a second guard. If the mint is rejected (e.g. the treasury's
//     per-period mint budget), the claim is released so the completion can be settled on a later
//     review instead of being silently marked paid.
//   - A completion whose mission carries a zero bonus is *settled at zero*, not left open. That is
//     deliberate: raising a mission's bonus later must not retroactively pay members who already
//     finished it while it was zero. What a completion is worth is fixed at the moment it happens.
//
// Credits are a non-fiat internal credits unit, never money: this is a mint (an issuance), and it
// is bounded by the treasury's per-period mint budget like every other mint.

import { queryDb } from 'lib/db/postgres';
// ServiceCredits is reached through the platform-owned interface, never lib/service-credits
// directly (owner decision 2026-08-03: strict plugin isolation; enforced by check-plugin-boundaries).
import { insertServiceCreditsAudit, mintGrant } from 'lib/shared/credits-interface';
import { insertSkillsHuntAudit } from './repository';
import { reportError } from 'lib/observability/report';

const SKILLS_HUNT_INCENTIVE_ACTOR_ID = 'skills-hunt-incentive-system';

type UnsettledCompletion = {
  progressId: string;
  missionId: string;
  missionTitle: string;
  bonusPoints: number;
};

async function listUnsettledCompletions(roundId: string, userId: string): Promise<UnsettledCompletion[]> {
  const result = await queryDb<{
    progress_id: string;
    mission_id: string;
    title: string;
    bonus_points: number;
  }>(
    `SELECT p.id::text AS progress_id, p.mission_id::text AS mission_id, m.title, m.bonus_points
     FROM skills_hunt_mission_progress p
     JOIN skills_hunt_missions m ON m.id = p.mission_id
     WHERE p.user_id = $1
       AND m.round_id = $2::uuid
       AND p.completed_at IS NOT NULL
       AND p.bonus_credited_at IS NULL`,
    [userId, roundId],
  );
  return result.rows.map((row) => ({
    progressId: row.progress_id,
    missionId: row.mission_id,
    missionTitle: row.title,
    bonusPoints: Number(row.bonus_points),
  }));
}

// Stamps the completion settled for `amount`, but only while it is still unsettled. Returns false
// when another run got there first, which is what keeps a concurrent review from paying twice.
async function claimCompletion(progressId: string, amount: number): Promise<boolean> {
  const result = await queryDb<{ id: string }>(
    `UPDATE skills_hunt_mission_progress
     SET bonus_credited_at = NOW(),
         metadata = metadata || jsonb_build_object('bonusSettledAmount', $2::int),
         updated_at = NOW()
     WHERE id = $1::uuid AND bonus_credited_at IS NULL
     RETURNING id::text AS id`,
    [progressId, amount],
  );
  return result.rows.length > 0;
}

async function releaseCompletionClaim(progressId: string): Promise<void> {
  await queryDb(
    `UPDATE skills_hunt_mission_progress
     SET bonus_credited_at = NULL,
         metadata = metadata - 'bonusSettledAmount',
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [progressId],
  );
}

async function auditBonusGrant(input: {
  reviewerUserId: string;
  userId: string;
  completion: UnsettledCompletion;
  governanceEventId: string;
  idempotencyKey: string;
}): Promise<void> {
  await insertServiceCreditsAudit({
    actorId: input.reviewerUserId,
    command: 'service-credits.governance.mint.grant.skills-hunt',
    policyStatus: 'allow',
    reason: 'skills_hunt_mission_bonus',
    targetType: 'governance_event',
    targetId: input.governanceEventId,
    metadata: {
      skillsHuntMissionId: input.completion.missionId,
      targetUserId: input.userId,
      amount: input.completion.bonusPoints,
      idempotencyKey: input.idempotencyKey,
    },
  });

  await insertSkillsHuntAudit({
    actorId: SKILLS_HUNT_INCENTIVE_ACTOR_ID,
    command: 'skills-hunt.mission.bonus_grant',
    policyStatus: 'allow',
    reason: 'mission_completed',
    targetType: 'mission',
    targetId: input.completion.missionId,
    metadata: { targetUserId: input.userId, amount: input.completion.bonusPoints },
  });
}

// Settles one completion. A zero-bonus mission is closed with no mint (nothing is owed); anything
// else is claimed, minted, and audited, with the claim released if the mint is rejected.
async function settleCompletion(input: {
  completion: UnsettledCompletion;
  userId: string;
  reviewerUserId: string;
}): Promise<void> {
  const { completion } = input;
  const claimed = await claimCompletion(completion.progressId, completion.bonusPoints);
  if (!claimed || completion.bonusPoints <= 0) {
    return;
  }

  const idempotencyKey = `skills-hunt-mission-bonus-${completion.missionId}-${input.userId}`;
  let grant: Awaited<ReturnType<typeof mintGrant>>;
  try {
    grant = await mintGrant({
      actorId: SKILLS_HUNT_INCENTIVE_ACTOR_ID,
      targetUserId: input.userId,
      amount: completion.bonusPoints,
      grantReason: 'skills_hunt_mission_bonus',
      governanceTicketId: `skills-hunt:mission:${completion.missionId}`,
      idempotencyKey,
    });
  } catch (mintError) {
    // Rejected (most likely the per-period mint budget) — release the claim so this completion is
    // retried on a later review rather than sitting marked-paid with nothing behind it.
    await releaseCompletionClaim(completion.progressId);
    throw mintError;
  }

  await auditBonusGrant({
    reviewerUserId: input.reviewerUserId,
    userId: input.userId,
    completion,
    governanceEventId: grant.governanceEventId,
    idempotencyKey,
  });
}

/**
 * Best-effort settlement of every mission this member has completed in this round that has not been
 * settled yet. Called by the review route after the review has committed; never throws, so a ledger
 * problem cannot fail the review. Normally settles the one mission the accept just completed, and
 * doubles as the catch-up for any completion whose earlier settlement attempt was rejected.
 */
export async function settleMissionBonusesBestEffort(input: {
  roundId: string;
  userId: string;
  reviewerUserId: string;
}): Promise<void> {
  try {
    const completions = await listUnsettledCompletions(input.roundId, input.userId);
    for (const completion of completions) {
      await settleCompletion({ completion, userId: input.userId, reviewerUserId: input.reviewerUserId });
    }
  } catch (error) {
    reportError(error, {
      area: 'skills-hunt',
      op: 'mission_bonus_settlement',
      extra: { roundId: input.roundId, userId: input.userId },
    });
  }
}
