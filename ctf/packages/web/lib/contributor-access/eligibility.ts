import { queryDb } from 'lib/db/postgres';
import {
  computeMemberCounterpartyCounts,
  computeMemberEventCounts,
  computeMemberFirstLogin,
  type MemberEventCounts,
} from './member-value-counts';
import { getContributorAccessConfig, type ContributorAccessConfig } from './repository';
import {
  CONTRIBUTOR_VALUE_EVENT_KEYS,
  EVENT_SOURCE_PLUGIN,
  effectiveWeight,
  type ContributorValueEventKey,
} from './weights';

// Contributor Access — the eligibility engine (working badge name "Keeper of the Commons";
// doc-comment only, no member-facing copy in this slice).
//
// Computes one categorical decision per member — eligible or not-yet — from the fifteen per-plugin
// value events (the same events Weekly Performance counts, per member, all-time) plus the gates:
// account age, distinct plugins, distinct counterparties, and clean standing (not revoked for
// cause). The recompute is ADDITIVE ONLY: a member who is already eligible stays eligible — the
// badge is permanent once earned and only a for-cause revoke (a reviewed harm/abuse action, via the
// admin revoke route) removes access. Never on inactivity, never on signal decay.
//
// Hard guardrails honored here (see TRUSTED_CHANNELS_AND_CONTRIBUTOR_BADGE_PROPOSAL.md):
// - No numeric score is ever returned by any member-facing API. The score and the per-event counts
//   live only in reason_snapshot, which no member surface reads.
// - This module never touches any Trust-plugin table or file (no trust_* reads or writes).
// - Foundation per-member call counts feed the math internally and are never exposed (rule 132).

type MemberEvaluation = {
  score: number;
  distinctPlugins: number;
  counterparties: number;
  accountAgeDays: number | null;
  countsByEvent: Partial<Record<ContributorValueEventKey, number>>;
  qualifies: boolean;
};

function accountAgeDays(firstLoginIso: string | undefined): number | null {
  if (!firstLoginIso) return null;
  const first = new Date(firstLoginIso).getTime();
  if (Number.isNaN(first)) return null;
  return Math.floor((Date.now() - first) / 86_400_000);
}

function evaluateMember(
  counts: Partial<Record<ContributorValueEventKey, number>>,
  counterparties: number,
  firstLoginIso: string | undefined,
  config: ContributorAccessConfig,
): MemberEvaluation {
  let score = 0;
  const plugins = new Set<string>();
  for (const key of CONTRIBUTOR_VALUE_EVENT_KEYS) {
    const count = counts[key] ?? 0;
    if (count <= 0) continue;
    score += effectiveWeight(key, config.weights) * count;
    plugins.add(EVENT_SOURCE_PLUGIN[key]);
  }
  const age = accountAgeDays(firstLoginIso);
  const qualifies =
    score >= config.threshold &&
    age != null &&
    age >= config.minAccountAgeDays &&
    plugins.size >= config.minDistinctPlugins &&
    counterparties >= config.minCounterparties;
  return {
    score,
    distinctPlugins: plugins.size,
    counterparties,
    accountAgeDays: age,
    countsByEvent: counts,
    qualifies,
  };
}

// Upsert one member's evaluation. Additive-only semantics live in the SQL:
// - eligible flips TRUE when the member newly qualifies AND is not revoked for cause; it is NEVER
//   flipped back to FALSE here (only the for-cause revoke route does that).
// - first_earned_at is set to NOW() only when it is still NULL.
// - reason_snapshot + computed_at refresh for everyone evaluated.
async function upsertEvaluation(userId: string, evaluation: MemberEvaluation): Promise<void> {
  const snapshot = {
    score: evaluation.score,
    distinctPlugins: evaluation.distinctPlugins,
    counterparties: evaluation.counterparties,
    accountAgeDays: evaluation.accountAgeDays,
    countsByEvent: evaluation.countsByEvent,
    qualifies: evaluation.qualifies,
  };
  await queryDb(
    `INSERT INTO contributor_access_eligibility
       (user_id, eligible, first_earned_at, reason_snapshot, computed_at)
     VALUES ($1, $2, CASE WHEN $2 THEN NOW() ELSE NULL END, $3::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       eligible = CASE
         WHEN contributor_access_eligibility.revoked_for_cause THEN contributor_access_eligibility.eligible
         ELSE contributor_access_eligibility.eligible OR EXCLUDED.eligible
       END,
       first_earned_at = COALESCE(
         contributor_access_eligibility.first_earned_at,
         CASE WHEN EXCLUDED.eligible THEN NOW() ELSE NULL END
       ),
       reason_snapshot = EXCLUDED.reason_snapshot,
       computed_at = NOW()`,
    [userId, evaluation.qualifies, JSON.stringify(snapshot)],
  );
}

export type ComputeEligibilityResult = {
  evaluated: number;
  eligible: number;
};

// Recompute eligibility for every member with at least one value event. Called by the internal
// recompute route on a weekly schedule — never instantly on an action, so nobody spikes the
// signals and coasts.
export async function computeEligibility(): Promise<ComputeEligibilityResult> {
  const config = await getContributorAccessConfig();
  const [counts, counterpartyCounts, firstLogins]: [MemberEventCounts, Map<string, number>, Map<string, string>] =
    await Promise.all([computeMemberEventCounts(), computeMemberCounterpartyCounts(), computeMemberFirstLogin()]);

  let evaluated = 0;
  for (const [userId, memberCounts] of counts) {
    const evaluation = evaluateMember(
      memberCounts,
      counterpartyCounts.get(userId) ?? 0,
      firstLogins.get(userId),
      config,
    );
    await upsertEvaluation(userId, evaluation);
    evaluated += 1;
  }

  const eligibleResult = await queryDb<{ v: string }>(
    `SELECT COUNT(*)::text AS v FROM contributor_access_eligibility WHERE eligible = TRUE`,
  );
  return { evaluated, eligible: Number(eligibleResult.rows[0]?.v ?? 0) };
}
