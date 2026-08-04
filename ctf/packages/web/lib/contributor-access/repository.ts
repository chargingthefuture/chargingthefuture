import { queryDb } from 'lib/db/postgres';

// Contributor Access — owned-table reads/writes (config, eligibility rows, audit trail).
// Categorical output only: nothing here ever returns a score to a caller that could surface it to
// a member — the reason_snapshot stays internal and the eligible list carries no numbers.

export type ContributorAccessConfig = {
  weights: Record<string, number>;
  threshold: number;
  minAccountAgeDays: number;
  minDistinctPlugins: number;
  minCounterparties: number;
  minEligibleToOpenChannel: number;
  channelOpen: boolean;
  updatedAt: string | null;
};

export const CONFIG_DEFAULTS: ContributorAccessConfig = {
  weights: {},
  threshold: 100,
  minAccountAgeDays: 90,
  minDistinctPlugins: 3,
  minCounterparties: 5,
  minEligibleToOpenChannel: 10,
  channelOpen: false,
  updatedAt: null,
};

type ConfigRow = {
  weights: Record<string, number>;
  threshold: string;
  min_account_age_days: number;
  min_distinct_plugins: number;
  min_counterparties: number;
  min_eligible_to_open_channel: number;
  channel_open: boolean;
  updated_at: string;
};

// The single config row, or the schema defaults when the row has never been written.
export async function getContributorAccessConfig(): Promise<ContributorAccessConfig> {
  const result = await queryDb<ConfigRow>(
    `SELECT weights, threshold::text, min_account_age_days, min_distinct_plugins, min_counterparties,
            min_eligible_to_open_channel, channel_open, updated_at::text
     FROM contributor_access_config WHERE id = 1`,
  );
  const row = result.rows[0];
  if (!row) {
    return CONFIG_DEFAULTS;
  }
  return {
    weights: row.weights ?? {},
    threshold: Number(row.threshold),
    minAccountAgeDays: row.min_account_age_days,
    minDistinctPlugins: row.min_distinct_plugins,
    minCounterparties: row.min_counterparties,
    minEligibleToOpenChannel: row.min_eligible_to_open_channel,
    channelOpen: row.channel_open,
    updatedAt: row.updated_at,
  };
}

export type ContributorAccessConfigUpdate = {
  weights: Record<string, number>;
  threshold: number;
  minAccountAgeDays: number;
  minDistinctPlugins: number;
  minCounterparties: number;
  minEligibleToOpenChannel: number;
  channelOpen: boolean;
};

export async function upsertContributorAccessConfig(input: ContributorAccessConfigUpdate): Promise<void> {
  await queryDb(
    `INSERT INTO contributor_access_config
       (id, weights, threshold, min_account_age_days, min_distinct_plugins, min_counterparties,
        min_eligible_to_open_channel, channel_open, updated_at)
     VALUES (1, $1::jsonb, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       weights = EXCLUDED.weights,
       threshold = EXCLUDED.threshold,
       min_account_age_days = EXCLUDED.min_account_age_days,
       min_distinct_plugins = EXCLUDED.min_distinct_plugins,
       min_counterparties = EXCLUDED.min_counterparties,
       min_eligible_to_open_channel = EXCLUDED.min_eligible_to_open_channel,
       channel_open = EXCLUDED.channel_open,
       updated_at = NOW()`,
    [
      JSON.stringify(input.weights),
      input.threshold,
      input.minAccountAgeDays,
      input.minDistinctPlugins,
      input.minCounterparties,
      input.minEligibleToOpenChannel,
      input.channelOpen,
    ],
  );
}

export type EligibleMember = {
  userId: string;
  username: string | null;
  firstEarnedAt: string | null;
  revokedForCause: boolean;
  revokedReason: string | null;
};

// Members who have earned eligibility (including for-cause revoked ones, flagged, so an admin can
// reinstate). No score, no reason_snapshot — categorical fields only.
export async function listEligibleMembers(): Promise<EligibleMember[]> {
  const result = await queryDb<{
    user_id: string;
    username: string | null;
    first_earned_at: string | null;
    revoked_for_cause: boolean;
    revoked_reason: string | null;
  }>(
    `SELECT e.user_id, u.username, e.first_earned_at::text, e.revoked_for_cause, e.revoked_reason
     FROM contributor_access_eligibility e
     LEFT JOIN users u ON u.id::text = e.user_id
     WHERE e.first_earned_at IS NOT NULL
     ORDER BY e.first_earned_at ASC`,
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    firstEarnedAt: row.first_earned_at,
    revokedForCause: row.revoked_for_cause,
    revokedReason: row.revoked_reason,
  }));
}

// Categorical membership check for the gated channel: eligible AND not revoked (a for-cause
// revoke already sets eligible = FALSE, so the flag alone is the whole answer).
export async function isMemberEligible(userId: string): Promise<boolean> {
  const result = await queryDb<{ user_id: string }>(
    `SELECT user_id FROM contributor_access_eligibility WHERE user_id = $1 AND eligible = TRUE`,
    [userId],
  );
  return result.rows.length > 0;
}

// The two membership sets the Stream sync needs: members to hold in the gated channel (eligible)
// and members to remove (revoked for cause). Ids only — no score, no snapshot.
export async function listChannelMembershipTargets(): Promise<{
  eligibleUserIds: string[];
  revokedUserIds: string[];
}> {
  const result = await queryDb<{ user_id: string; eligible: boolean; revoked_for_cause: boolean }>(
    `SELECT user_id, eligible, revoked_for_cause
     FROM contributor_access_eligibility
     WHERE eligible = TRUE OR revoked_for_cause = TRUE`,
  );
  const eligibleUserIds: string[] = [];
  const revokedUserIds: string[] = [];
  for (const row of result.rows) {
    if (row.eligible) {
      eligibleUserIds.push(row.user_id);
    } else if (row.revoked_for_cause) {
      revokedUserIds.push(row.user_id);
    }
  }
  return { eligibleUserIds, revokedUserIds };
}

export async function countEligibleMembers(): Promise<number> {
  const result = await queryDb<{ v: string }>(
    `SELECT COUNT(*)::text AS v FROM contributor_access_eligibility WHERE eligible = TRUE`,
  );
  return Number(result.rows[0]?.v ?? 0);
}

// For-cause revoke: the ONLY path that unsets eligible (never inactivity, never signal decay).
// Returns false when the member has no earned eligibility row to revoke.
export async function revokeEligibility(input: {
  userId: string;
  reason: string;
  revokedBy: string;
}): Promise<boolean> {
  const result = await queryDb<{ user_id: string }>(
    `UPDATE contributor_access_eligibility
     SET eligible = FALSE, revoked_for_cause = TRUE, revoked_reason = $2, revoked_at = NOW(), revoked_by = $3
     WHERE user_id = $1 AND first_earned_at IS NOT NULL
     RETURNING user_id`,
    [input.userId, input.reason, input.revokedBy],
  );
  return result.rows.length > 0;
}

// Clears a for-cause revocation; eligibility returns because it was previously earned
// (first_earned_at is never cleared). Returns false when no revoked row exists.
export async function reinstateEligibility(userId: string): Promise<boolean> {
  const result = await queryDb<{ user_id: string }>(
    `UPDATE contributor_access_eligibility
     SET eligible = TRUE, revoked_for_cause = FALSE, revoked_reason = NULL, revoked_at = NULL, revoked_by = NULL
     WHERE user_id = $1 AND revoked_for_cause = TRUE AND first_earned_at IS NOT NULL
     RETURNING user_id`,
    [userId],
  );
  return result.rows.length > 0;
}

// Best-effort audit write — an audit failure must never fail the admin action itself; the action's
// own error handling reports real errors.
export async function insertContributorAccessAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await queryDb(
      `INSERT INTO contributor_access_audit_trail
        (id, actor_id, command, policy_status, reason, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        crypto.randomUUID(),
        input.actorId,
        input.command,
        input.policyStatus,
        input.reason,
        input.targetType,
        input.targetId,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch {
    // no-trace: swallowed on purpose, for the reason given above.
  }
}
