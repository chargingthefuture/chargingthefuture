import { queryDb } from 'lib/db/postgres';
import type {
  CreateUnlockSubmissionInput,
  ReviewUnlockSubmissionInput,
  RevokeUnlockRewardInput,
  UnlockAccessTier,
  UnlockDashboardSnapshot,
  UnlockQueueFilters,
  UnlockStatus,
  UnlockSubmission,
} from './types';

type UnlockRuntimeConfigRow = {
  submission_window_hours: number;
  reminder_schedule_hours: number[];
  incentive_amount: string;
  support_only_after_expiry: boolean;
};

export type UnlockRuntimeConfig = {
  submissionWindowHours: number;
  reminderScheduleHours: number[];
  incentiveAmount: number;
  supportOnlyAfterExpiry: boolean;
};

type UnlockSubmissionRow = {
  id: number;
  user_id: string;
  quora_profile_url: string;
  quora_profile_url_normalized: string;
  review_status: UnlockSubmission['reviewStatus'];
  access_tier: UnlockSubmission['accessTier'];
  unlock_window_expires_at: Date;
  reminder_stage: number;
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  incentive_granted_at: Date | null;
  reward_withheld_at: Date | null;
  reward_revoked_at: Date | null;
  // Only present on the admin queue list (a per-URL COUNT). Undefined elsewhere.
  shared_url_account_count?: string;
  created_at: Date;
  updated_at: Date;
};

type UnlockDashboardRow = {
  pending_count: string;
  approved_count: string;
  rejected_count: string;
  spam_count: string;
  locked_support_only_count: string;
};

function mapUnlockSubmission(row: UnlockSubmissionRow): UnlockSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    quoraProfileUrl: row.quora_profile_url,
    quoraProfileUrlNormalized: row.quora_profile_url_normalized,
    reviewStatus: row.review_status,
    accessTier: row.access_tier,
    unlockWindowExpiresAt: row.unlock_window_expires_at.toISOString(),
    reminderStage: row.reminder_stage,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    reviewNote: row.review_note,
    incentiveGrantedAt: row.incentive_granted_at ? row.incentive_granted_at.toISOString() : null,
    rewardWithheldAt: row.reward_withheld_at ? row.reward_withheld_at.toISOString() : null,
    rewardRevokedAt: row.reward_revoked_at ? row.reward_revoked_at.toISOString() : null,
    ...(row.shared_url_account_count !== undefined
      ? { sharedUrlAccountCount: Number(row.shared_url_account_count) }
      : {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUnlockRuntimeConfig(row: UnlockRuntimeConfigRow | undefined): UnlockRuntimeConfig {
  return {
    submissionWindowHours: row?.submission_window_hours ?? 168,
    reminderScheduleHours: row?.reminder_schedule_hours ?? [0, 24, 72, 168],
    incentiveAmount: Number(row?.incentive_amount ?? '100'),
    supportOnlyAfterExpiry: row?.support_only_after_expiry ?? true,
  };
}

export async function getUnlockRuntimeConfig(): Promise<UnlockRuntimeConfig> {
  // Resilience: never let the runtime-config read block a member's verification. This runs before
  // the submission INSERT, so if `unlock_runtime_config` is missing/unmigrated (or a column it reads
  // — e.g. incentive_amount/support_only_after_expiry — does not yet exist on the connected DB) the
  // query would throw and surface as a generic 503 ("Unlock submission unavailable."). Fall back to
  // the documented defaults instead. (If you hit this, the real fix is running the Update Neon DB
  // action so the guarded ALTERs are applied; this just stops it from blocking submissions.)
  try {
    const result = await queryDb<UnlockRuntimeConfigRow>(
      `SELECT
         submission_window_hours,
         reminder_schedule_hours,
         incentive_amount::text,
         support_only_after_expiry
       FROM unlock_runtime_config
       WHERE singleton_id = 1
       LIMIT 1`,
    );

    return mapUnlockRuntimeConfig(result.rows[0]);
  } catch (error) {
    console.error('[unlock] runtime config read failed; using defaults', error);
    return mapUnlockRuntimeConfig(undefined);
  }
}

export async function getEffectiveUnlockAccessTier(userId: string): Promise<UnlockAccessTier | null> {
  const runtimeConfig = await getUnlockRuntimeConfig();

  if (runtimeConfig.supportOnlyAfterExpiry) {
    await queryDb(
      `UPDATE unlock_verification_submissions
       SET access_tier = 'locked_support_only', updated_at = NOW()
       WHERE user_id = $1
         AND review_status = 'pending'
         AND access_tier = 'pending_readonly'
         AND unlock_window_expires_at <= NOW()`,
      [userId],
    );
  }

  const result = await queryDb<{ access_tier: UnlockAccessTier }>(
    `SELECT access_tier
     FROM unlock_verification_submissions
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0]?.access_tier ?? null;
}

// Of the given user ids, which have full (approved) Unlock access. One query against the stored
// submission tier (set to `approved_full` on approval). Used to keep not-yet-unlocked people — e.g. a
// v2 user who signed into v3 but never completed Unlock — out of flows that should be unlocked-only,
// such as PeerProgramming cohort assignment. Returns a Set for O(1) membership checks.
export async function listUnlockedUserIds(userIds: string[]): Promise<Set<string>> {
  const unlocked = new Set<string>();
  const unique = Array.from(
    new Set(userIds.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
  if (unique.length === 0) return unlocked;

  const result = await queryDb<{ user_id: string }>(
    `SELECT user_id
       FROM unlock_verification_submissions
      WHERE user_id = ANY($1::text[])
        AND access_tier = 'approved_full'`,
    [unique],
  );
  for (const row of result.rows) unlocked.add(row.user_id);
  return unlocked;
}

export async function getUnlockStatusForUser(userId: string): Promise<UnlockStatus> {
  const accessTier = await getEffectiveUnlockAccessTier(userId);
  const result = await queryDb<Pick<UnlockSubmissionRow, 'review_status' | 'unlock_window_expires_at' | 'reminder_stage' | 'incentive_granted_at'>>(
    `SELECT
       review_status,
       unlock_window_expires_at,
       reminder_stage,
       incentive_granted_at
     FROM unlock_verification_submissions
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];

  return {
    userId,
    accessTier,
    reviewStatus: row?.review_status ?? null,
    unlockWindowExpiresAt: row?.unlock_window_expires_at ? row.unlock_window_expires_at.toISOString() : null,
    reminderStage: row?.reminder_stage ?? 0,
    incentiveGrantedAt: row?.incentive_granted_at ? row.incentive_granted_at.toISOString() : null,
    hasSubmission: Boolean(row),
  };
}

export async function createOrUpdateUnlockSubmission(input: CreateUnlockSubmissionInput): Promise<UnlockSubmission> {
  const runtimeConfig = await getUnlockRuntimeConfig();
  const submissionWindowHours = runtimeConfig.submissionWindowHours;

  const result = await queryDb<UnlockSubmissionRow>(
    `INSERT INTO unlock_verification_submissions (
       user_id,
       quora_profile_url,
       quora_profile_url_normalized,
       review_status,
       access_tier,
       unlock_window_expires_at
     )
     VALUES (
       $1,
       $2,
       $3,
       'pending',
       'pending_readonly',
       NOW() + (($4::text || ' hours')::interval)
     )
     ON CONFLICT (user_id) DO UPDATE
     SET
       quora_profile_url = EXCLUDED.quora_profile_url,
       quora_profile_url_normalized = EXCLUDED.quora_profile_url_normalized,
       review_status = 'pending',
       access_tier = 'pending_readonly',
       unlock_window_expires_at = NOW() + (($4::text || ' hours')::interval),
       reviewed_by_user_id = NULL,
       reviewed_at = NULL,
       review_note = NULL,
       reminder_stage = 0,
       updated_at = NOW()
     RETURNING
       id,
       user_id,
       quora_profile_url,
       quora_profile_url_normalized,
       review_status,
       access_tier,
       unlock_window_expires_at,
       reminder_stage,
       reviewed_by_user_id,
       reviewed_at,
       review_note,
       incentive_granted_at,
       reward_withheld_at,
       reward_revoked_at,
       created_at,
       updated_at`,
    [input.userId, input.quoraProfileUrl, input.quoraProfileUrlNormalized, String(submissionWindowHours)],
  );

  return mapUnlockSubmission(result.rows[0]);
}

export async function listUnlockSubmissions(filters: UnlockQueueFilters = {}): Promise<UnlockSubmission[]> {
  const values: unknown[] = [];
  const whereParts: string[] = [];

  if (filters.reviewStatus) {
    values.push(filters.reviewStatus);
    whereParts.push(`review_status = $${values.length}`);
  }

  if (filters.accessTier) {
    values.push(filters.accessTier);
    whereParts.push(`access_tier = $${values.length}`);
  }

  values.push(Math.min(Math.max(filters.limit ?? 100, 1), 200));

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  const result = await queryDb<UnlockSubmissionRow>(
    `SELECT
       id,
       user_id,
       quora_profile_url,
       quora_profile_url_normalized,
       review_status,
       access_tier,
       unlock_window_expires_at,
       reminder_stage,
       reviewed_by_user_id,
       reviewed_at,
       review_note,
       incentive_granted_at,
       reward_withheld_at,
       reward_revoked_at,
       created_at,
       updated_at,
       (SELECT COUNT(*)
          FROM unlock_verification_submissions dup
         WHERE dup.quora_profile_url_normalized = s.quora_profile_url_normalized) AS shared_url_account_count
     FROM unlock_verification_submissions s
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values,
  );

  return result.rows.map(mapUnlockSubmission);
}

// Approved submissions whose ServiceCredits reward never landed (the gap a failed mint leaves behind).
// Used by the background reconciliation job to self-heal missed rewards.
export async function listApprovedUnincentivizedSubmissions(limit = 100): Promise<UnlockSubmission[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const result = await queryDb<UnlockSubmissionRow>(
    `SELECT
       id,
       user_id,
       quora_profile_url,
       quora_profile_url_normalized,
       review_status,
       access_tier,
       unlock_window_expires_at,
       reminder_stage,
       reviewed_by_user_id,
       reviewed_at,
       review_note,
       incentive_granted_at,
       reward_withheld_at,
       reward_revoked_at,
       created_at,
       updated_at
     FROM unlock_verification_submissions
     WHERE review_status = 'approved' AND incentive_granted_at IS NULL
       AND reward_withheld_at IS NULL AND reward_revoked_at IS NULL
     ORDER BY reviewed_at ASC NULLS FIRST
     LIMIT $1`,
    [safeLimit],
  );

  return result.rows.map(mapUnlockSubmission);
}

export async function reviewUnlockSubmission(input: ReviewUnlockSubmissionInput): Promise<UnlockSubmission | null> {
  const accessTier = input.reviewStatus === 'approved' ? 'approved_full' : 'locked_support_only';

  const result = await queryDb<UnlockSubmissionRow>(
    `UPDATE unlock_verification_submissions
     SET
       review_status = $1,
       access_tier = $2,
       reviewed_by_user_id = $3,
       reviewed_at = NOW(),
       review_note = $4,
       updated_at = NOW()
     WHERE id = $5
     RETURNING
       id,
       user_id,
       quora_profile_url,
       quora_profile_url_normalized,
       review_status,
       access_tier,
       unlock_window_expires_at,
       reminder_stage,
       reviewed_by_user_id,
       reviewed_at,
       review_note,
       incentive_granted_at,
       reward_withheld_at,
       reward_revoked_at,
       created_at,
       updated_at`,
    [input.reviewStatus, accessTier, input.actorUserId, input.reviewNote ?? null, input.submissionId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapUnlockSubmission(result.rows[0]);
}

// Admin correction path: overwrite the stored Quora profile URL (and its normalized form) for a
// single submission, e.g. when a member submitted a link with a typo. Does not touch review status,
// access tier, or the verification window. Returns the updated submission, or null if no row matched.
export async function updateUnlockSubmissionQuoraUrl(
  submissionId: number,
  quoraProfileUrl: string,
  quoraProfileUrlNormalized: string,
): Promise<UnlockSubmission | null> {
  const result = await queryDb<UnlockSubmissionRow>(
    `UPDATE unlock_verification_submissions
     SET
       quora_profile_url = $2,
       quora_profile_url_normalized = $3,
       updated_at = NOW()
     WHERE id = $1
     RETURNING
       id,
       user_id,
       quora_profile_url,
       quora_profile_url_normalized,
       review_status,
       access_tier,
       unlock_window_expires_at,
       reminder_stage,
       reviewed_by_user_id,
       reviewed_at,
       review_note,
       incentive_granted_at,
       reward_withheld_at,
       reward_revoked_at,
       created_at,
       updated_at`,
    [submissionId, quoraProfileUrl, quoraProfileUrlNormalized],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapUnlockSubmission(result.rows[0]);
}

export async function markUnlockIncentiveGranted(submissionId: number): Promise<boolean> {
  const result = await queryDb<{ id: number }>(
    `UPDATE unlock_verification_submissions
     SET incentive_granted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND review_status = 'approved' AND incentive_granted_at IS NULL
     RETURNING id`,
    [submissionId],
  );

  return (result.rowCount ?? 0) > 0;
}

// Load a single submission by its serial id. The admin revoke / determination routes operate by id.
export async function getUnlockSubmissionById(submissionId: number): Promise<UnlockSubmission | null> {
  const result = await queryDb<UnlockSubmissionRow>(
    `SELECT
       id, user_id, quora_profile_url, quora_profile_url_normalized, review_status, access_tier,
       unlock_window_expires_at, reminder_stage, reviewed_by_user_id, reviewed_at, review_note,
       incentive_granted_at, reward_withheld_at, reward_revoked_at, created_at, updated_at
     FROM unlock_verification_submissions
     WHERE id = $1
     LIMIT 1`,
    [submissionId],
  );

  return result.rows[0] ? mapUnlockSubmission(result.rows[0]) : null;
}

// Duplicate-identity guard. The account (other than excludeUserId) that currently HOLDS the verification
// reward for a normalized Quora URL — approved, reward granted, not revoked. Returns its user id, or null
// when the identity's reward is unclaimed (free to grant). Earliest grant wins if more than one slipped
// through (e.g. a rare concurrent-grant race), so the holder is stable.
export async function getUnlockRewardHolderForUrl(
  normalizedUrl: string,
  excludeUserId: string,
): Promise<string | null> {
  const result = await queryDb<{ user_id: string }>(
    `SELECT user_id
       FROM unlock_verification_submissions
      WHERE quora_profile_url_normalized = $1
        AND user_id <> $2
        AND review_status = 'approved'
        AND incentive_granted_at IS NOT NULL
        AND reward_revoked_at IS NULL
      ORDER BY incentive_granted_at ASC
      LIMIT 1`,
    [normalizedUrl, excludeUserId],
  );

  return result.rows[0]?.user_id ?? null;
}

// Hold this submission's reward for an admin determination (another account already holds the identity).
// Only flips a not-yet-granted submission, so it can never hide an already-paid reward.
export async function markUnlockRewardWithheld(submissionId: number): Promise<void> {
  await queryDb(
    `UPDATE unlock_verification_submissions
     SET reward_withheld_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND incentive_granted_at IS NULL`,
    [submissionId],
  );
}

// Clear a withhold so the reward can be granted (an admin determined this account keeps the identity).
export async function clearUnlockRewardWithheld(submissionId: number): Promise<void> {
  await queryDb(
    `UPDATE unlock_verification_submissions
     SET reward_withheld_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [submissionId],
  );
}

// Admin determination "loser" path: claw a reward back. Marks the submission rejected + support-only and
// stamps reward_revoked_at, so the reconcile job never re-grants it. The ServiceCredits clawback (burn) is
// done by the route via burnCredits; this only moves the submission's verification state. Returns the
// updated submission, or null if no row matched.
export async function revokeUnlockSubmissionReward(
  input: RevokeUnlockRewardInput,
): Promise<UnlockSubmission | null> {
  const result = await queryDb<UnlockSubmissionRow>(
    `UPDATE unlock_verification_submissions
     SET review_status = 'rejected',
         access_tier = 'locked_support_only',
         reward_revoked_at = NOW(),
         reward_withheld_at = NULL,
         reviewed_by_user_id = $2,
         reviewed_at = NOW(),
         review_note = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING
       id, user_id, quora_profile_url, quora_profile_url_normalized, review_status, access_tier,
       unlock_window_expires_at, reminder_stage, reviewed_by_user_id, reviewed_at, review_note,
       incentive_granted_at, reward_withheld_at, reward_revoked_at, created_at, updated_at`,
    [input.submissionId, input.actorUserId, input.reviewNote ?? null],
  );

  return result.rows[0] ? mapUnlockSubmission(result.rows[0]) : null;
}

export async function getUnlockDashboardSnapshot(): Promise<UnlockDashboardSnapshot> {
  const result = await queryDb<UnlockDashboardRow>(
    `SELECT
       COUNT(*) FILTER (WHERE review_status = 'pending')::text AS pending_count,
       COUNT(*) FILTER (WHERE review_status = 'approved')::text AS approved_count,
       COUNT(*) FILTER (WHERE review_status = 'rejected')::text AS rejected_count,
       COUNT(*) FILTER (WHERE review_status = 'spam')::text AS spam_count,
       COUNT(*) FILTER (WHERE access_tier = 'locked_support_only')::text AS locked_support_only_count
     FROM unlock_verification_submissions`,
  );

  const row = result.rows[0];

  return {
    pendingCount: Number(row?.pending_count ?? 0),
    approvedCount: Number(row?.approved_count ?? 0),
    rejectedCount: Number(row?.rejected_count ?? 0),
    spamCount: Number(row?.spam_count ?? 0),
    lockedSupportOnlyCount: Number(row?.locked_support_only_count ?? 0),
  };
}

export async function insertUnlockAudit(input: {
  actorUserId: string | null;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetUserId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  // Best-effort: the audit row is a secondary record, but the submission route awaits this call, so
  // a throw here (e.g. a legacy unlock_audit_log missing a column, or its user_id/action still NOT
  // NULL) would turn an otherwise-successful submission into a generic 503 for the member. Never let
  // the audit write block the member flow — log the real cause and move on.
  try {
    await queryDb(
      `INSERT INTO unlock_audit_log (
         actor_user_id,
         command,
         policy_status,
         reason,
         target_user_id,
         request_id,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        input.actorUserId,
        input.command,
        input.policyStatus,
        input.reason,
        input.targetUserId ?? null,
        input.requestId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch (error) {
    console.error('[unlock] audit write failed (non-blocking)', error);
  }
}
