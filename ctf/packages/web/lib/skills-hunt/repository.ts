// Service Credits Transaction Row and Mapping
type SkillsHuntServiceCreditsTransactionRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  reason: string | null;
  submission_id: string | null;
  created_at: Date;
};

import type { SkillsHuntServiceCreditsTransaction, SkillsHuntServiceCreditsTransactionInput } from './types';

function mapServiceCreditsTransaction(row: SkillsHuntServiceCreditsTransactionRow): SkillsHuntServiceCreditsTransaction {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amount: row.amount,
    reason: row.reason,
    submissionId: row.submission_id,
    createdAtIso: toIso(row.created_at),
  };
}

export async function createSkillsHuntServiceCreditsTransaction(
  client: PoolClient,
  fromUserId: string,
  input: SkillsHuntServiceCreditsTransactionInput
): Promise<SkillsHuntServiceCreditsTransaction> {
  const result = await client.query<SkillsHuntServiceCreditsTransactionRow>(
    `
      INSERT INTO skills_hunt_service_credits_transactions
        (from_user_id, to_user_id, amount, reason, submission_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [fromUserId, input.toUserId, input.amount, input.reason ?? null, input.submissionId ?? null]
  );
  return mapServiceCreditsTransaction(result.rows[0]);
}

export async function getSkillsHuntServiceCreditsTransactionsForUser(
  client: PoolClient,
  userId: string
): Promise<SkillsHuntServiceCreditsTransaction[]> {
  const result = await client.query<SkillsHuntServiceCreditsTransactionRow>(
    `
      SELECT * FROM skills_hunt_service_credits_transactions
      WHERE from_user_id = $1 OR to_user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );
  return result.rows.map(mapServiceCreditsTransaction);
}
import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  SKILLS_HUNT_DEFAULT_PAGE,
  SKILLS_HUNT_DEFAULT_PAGE_SIZE,
  SKILLS_HUNT_DISPLAY_NAME_PATTERN,
  SKILLS_HUNT_MAX_BIO_LENGTH,
  SKILLS_HUNT_MAX_DISPLAY_NAME_LENGTH,
  SKILLS_HUNT_MAX_PROPOSED_SKILLS_PER_SUBMISSION,
  SKILLS_HUNT_MAX_SKILLS_PER_SUBMISSION,
  SKILLS_HUNT_MAX_SKILL_LABEL_LENGTH,
  SKILLS_HUNT_MIN_DISPLAY_NAME_LENGTH,
  SKILLS_HUNT_MAX_PAGE_SIZE,
  SKILLS_HUNT_MAX_REVIEW_NOTES_LENGTH,
  SKILLS_HUNT_MAX_ROUND_DESCRIPTION_LENGTH,
  SKILLS_HUNT_MAX_ROUND_NAME_LENGTH,
  SKILLS_HUNT_MAX_URL_LENGTH,
  SKILLS_HUNT_REJECTION_GUARD_SAMPLE_SIZE,
  SKILLS_HUNT_REJECTION_GUARD_THRESHOLD,
  SKILLS_HUNT_REPUTATION,
  SKILLS_HUNT_SCORE_WEIGHTS_SPEC,
} from './constants';
import type {
  SkillsHuntAchievement,
  SkillsHuntFeatureRewardCard,
  SkillsHuntFeatureRewardCardInput,
  SkillsHuntGeneratedDirectoryProfile,
  SkillsHuntLeaderboardItem,
  SkillsHuntLeaderboardMode,
  SkillsHuntNotification,
  SkillsHuntPagination,
  SkillsHuntReputationProfile,
  SkillsHuntReviewAction,
  SkillsHuntRound,
  SkillsHuntRoundInput,
  SkillsHuntRoundStatus,
  SkillsHuntSubmission,
  SkillsHuntSubmissionInput,
  SkillsHuntSubmissionReviewInput,
} from './types';
import { checkUrlLiveness } from './url-validation';
import { recomputeMissionProgressForUser } from './missions';
import {
  captureTopTenUserIds,
  emitAchievementUnlocked,
  emitLeaderboardTopTen,
  emitMissionComplete,
  emitSubmissionAccepted,
  emitSubmissionRejected,
  readCurrentTopTen,
} from './notifications';
import { snapshotRareSkillsForRound } from './rare-skill-snapshot';

type CountRow = { total: string };

type SkillsHuntRoundRow = {
  id: string;
  name: string;
  description: string | null;
  status: SkillsHuntRoundStatus;
  starts_at: Date;
  ends_at: Date;
  scoring_config: Record<string, unknown>;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type SkillsHuntSubmissionRow = {
  id: string;
  round_id: string;
  submitter_user_id: string;
  submitter_username: string | null;
  display_name: string;
  bio: string;
  quora_profile_url: string;
  skills: unknown;
  proposed_skills?: unknown;
  claimed_professions: unknown;
  status: 'pending' | 'accepted' | 'rejected' | 'flagged';
  points_awarded: number;
  participation_points?: number | null;
  credit_granted?: boolean | null;
  url_validation_result?: 'valid' | 'invalid' | 'dead' | null;
  url_validation_checked_at?: Date | null;
  score_breakdown: Record<string, unknown>;
  review_action: SkillsHuntReviewAction | null;
  review_notes: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  edit_history?: unknown;
  edited_at?: Date | null;
  deleted_at?: Date | null;
  directory_profile_generated_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type SkillsHuntLeaderboardRow = {
  rank: number;
  score: number;
  accepted_count: number;
  first_match_count?: number | null;
  pending_points?: number | null;
  rare_skill_bonus: number;
  user_id: string | null;
  username_snapshot: string | null;
  team_key: string | null;
  last_submission_at?: Date | null;
  metadata: Record<string, unknown>;
};

type SkillsHuntNotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
};

type SkillsHuntAchievementRow = {
  id: string;
  user_id: string;
  code: string;
  title: string;
  description: string;
  round_id?: string | null;
  metadata: Record<string, unknown>;
  archived_at?: Date | null;
  awarded_at: Date;
};

type SkillsHuntFeatureRewardCardRow = {
  title: string;
  description: string;
  cta_label: string;
  cta_url: string;
  is_active: boolean;
  updated_by_user_id: string;
  updated_at: Date;
};

type SkillsHuntAuditRow = {
  id: string;
  actor_id: string;
  command: string;
  policy_status: 'allow' | 'deny';
  reason: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeArray(items: string[] | undefined): string[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const cleaned = items
    .filter((value): value is string => typeof value === 'string')
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);

  return Array.from(new Set(cleaned));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function isIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function containsUnsafeText(value: string): boolean {
  const lowered = value.toLowerCase();
  return lowered.includes('<script') || /<[^>]+>/.test(value);
}

function normalizeQuoraProfileUrl(value: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    throw new Error('skills_hunt_invalid_quora_url');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!hostname.endsWith('quora.com')) {
    throw new Error('skills_hunt_invalid_quora_url');
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, '');
  if (pathname.length < 2 || !pathname.includes('/')) {
    throw new Error('skills_hunt_invalid_quora_url');
  }

  parsedUrl.hash = '';
  parsedUrl.search = '';
  return parsedUrl.toString();
}

function buildSignatureHash(url: string, skills: string[], proposedSkills: string[] = []): string {
  const normalizedSkills = [...skills].sort((left, right) => left.localeCompare(right));
  // Include proposedSkills in the signature so submissions differing only in
  // free-text proposed skills are NOT collapsed as duplicates. Separated by a
  // distinct delimiter ("##") so a proposed label can never collide with a
  // taxonomy label of the same name.
  const normalizedProposed = [...proposedSkills].sort((left, right) => left.localeCompare(right));
  return createHash('sha256')
    .update(`${url.toLowerCase()}::${normalizedSkills.join('|').toLowerCase()}##${normalizedProposed.join('|').toLowerCase()}`)
    .digest('hex');
}

function mapRound(row: SkillsHuntRoundRow): SkillsHuntRound {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startsAtIso: toIso(row.starts_at),
    endsAtIso: toIso(row.ends_at),
    scoringConfig: normalizeJsonObject(row.scoring_config),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapEditHistory(value: unknown): SkillsHuntSubmission['editHistory'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is SkillsHuntSubmission['editHistory'][number] => {
    return Boolean(
      entry
        && typeof entry === 'object'
        && !Array.isArray(entry)
        && typeof (entry as { editedAtIso?: unknown }).editedAtIso === 'string'
        && typeof (entry as { editedByUserId?: unknown }).editedByUserId === 'string',
    );
  });
}

function mapSubmission(row: SkillsHuntSubmissionRow): SkillsHuntSubmission {
  return {
    id: row.id,
    roundId: row.round_id,
    submitterUserId: row.submitter_user_id,
    submitterUsername: row.submitter_username,
    displayName: row.display_name,
    bio: row.bio,
    quoraProfileUrl: row.quora_profile_url,
    skills: asStringArray(row.skills),
    proposedSkills: asStringArray(row.proposed_skills),
    claimedProfessions: asStringArray(row.claimed_professions),
    status: row.status,
    pointsAwarded: row.points_awarded,
    participationPoints: row.participation_points ?? 0,
    creditGranted: row.credit_granted ?? false,
    urlValidationResult: row.url_validation_result ?? null,
    urlValidationCheckedAtIso: row.url_validation_checked_at ? toIso(row.url_validation_checked_at) : null,
    scoreBreakdown: normalizeJsonObject(row.score_breakdown),
    reviewAction: row.review_action,
    reviewNotes: row.review_notes,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAtIso: row.reviewed_at ? toIso(row.reviewed_at) : null,
    editHistory: mapEditHistory(row.edit_history),
    editedAtIso: row.edited_at ? toIso(row.edited_at) : null,
    deletedAtIso: row.deleted_at ? toIso(row.deleted_at) : null,
    directoryProfileGeneratedAtIso: row.directory_profile_generated_at ? toIso(row.directory_profile_generated_at) : null,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapLeaderboard(row: SkillsHuntLeaderboardRow): SkillsHuntLeaderboardItem {
  return {
    rank: row.rank,
    score: row.score,
    acceptedCount: row.accepted_count,
    firstMatchCount: row.first_match_count ?? 0,
    pendingPoints: row.pending_points ?? 0,
    rareSkillBonus: row.rare_skill_bonus,
    userId: row.user_id,
    usernameSnapshot: row.username_snapshot,
    teamKey: row.team_key,
    lastSubmissionAtIso: row.last_submission_at ? toIso(row.last_submission_at) : null,
    metadata: normalizeJsonObject(row.metadata),
  };
}

function mapNotification(row: SkillsHuntNotificationRow): SkillsHuntNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    metadata: normalizeJsonObject(row.metadata),
    isRead: row.is_read,
    readAtIso: row.read_at ? toIso(row.read_at) : null,
    createdAtIso: toIso(row.created_at),
  };
}

function mapAchievement(row: SkillsHuntAchievementRow): SkillsHuntAchievement {
  return {
    id: row.id,
    userId: row.user_id,
    code: row.code,
    title: row.title,
    description: row.description,
    roundId: row.round_id ?? null,
    metadata: normalizeJsonObject(row.metadata),
    archivedAtIso: row.archived_at ? toIso(row.archived_at) : null,
    awardedAtIso: toIso(row.awarded_at),
  };
}

function mapFeatureRewardCard(row: SkillsHuntFeatureRewardCardRow): SkillsHuntFeatureRewardCard {
  return {
    title: row.title,
    description: row.description,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    isActive: row.is_active,
    updatedByUserId: row.updated_by_user_id,
    updatedAtIso: toIso(row.updated_at),
  };
}

export function parsePaginationParams(url: string): SkillsHuntPagination {
  const params = new URL(url).searchParams;
  const pageRaw = Number.parseInt(params.get('page') ?? '', 10);
  const pageSizeRaw = Number.parseInt(params.get('pageSize') ?? '', 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : SKILLS_HUNT_DEFAULT_PAGE;
  const pageSizeBase = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : SKILLS_HUNT_DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize: Math.min(pageSizeBase, SKILLS_HUNT_MAX_PAGE_SIZE),
  };
}

export function validateRoundInput(input: SkillsHuntRoundInput): boolean {
  const name = normalizeText(input.name ?? '');
  const description = normalizeNullableText(input.description);
  const validStatus = ['draft', 'active', 'closed', 'archived'].includes(input.status);

  return name.length > 0
    && name.length <= SKILLS_HUNT_MAX_ROUND_NAME_LENGTH
    && (!description || description.length <= SKILLS_HUNT_MAX_ROUND_DESCRIPTION_LENGTH)
    && validStatus
    && isIsoDatetime(input.startsAtIso)
    && isIsoDatetime(input.endsAtIso)
    && Date.parse(input.endsAtIso) > Date.parse(input.startsAtIso);
}

function isLengthInRange(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

function hasUnsafeCollectionText(values: string[]): boolean {
  return values.some((value) => containsUnsafeText(value));
}

export function validateSubmissionInput(input: SkillsHuntSubmissionInput): boolean {
  const displayName = normalizeText(input.displayName ?? '');
  const bio = normalizeText(input.bio ?? '');
  const skills = normalizeArray(input.skills);
  const proposedSkills = normalizeArray(input.proposedSkills ?? []);
  const claimedProfessions = normalizeArray(input.claimedProfessions);

  const hasValidRoundId = typeof input.roundId === 'string' && input.roundId.length > 0;

  // Spec §2.1: display name 2–100 chars, letters/digits/spaces only.
  const hasValidDisplayName =
    isLengthInRange(displayName, SKILLS_HUNT_MIN_DISPLAY_NAME_LENGTH, SKILLS_HUNT_MAX_DISPLAY_NAME_LENGTH)
    && SKILLS_HUNT_DISPLAY_NAME_PATTERN.test(displayName);

  // Spec §2.1: bio is optional (max 280). Length 0 accepted; >280 rejected.
  const hasValidBio = bio.length === 0 || bio.length <= SKILLS_HUNT_MAX_BIO_LENGTH;

  const quoraProfileUrl = typeof input.quoraProfileUrl === 'string' ? input.quoraProfileUrl.trim() : '';
  const hasValidUrl = isLengthInRange(quoraProfileUrl, 1, SKILLS_HUNT_MAX_URL_LENGTH);

  // Spec §2.1: ≥1 taxonomy-or-proposed skill, sum capped at 10, each ≤ 40 chars.
  const totalSkills = skills.length + proposedSkills.length;
  const allSkillsWithinLabelLimit = [...skills, ...proposedSkills].every(
    (label) => label.length <= SKILLS_HUNT_MAX_SKILL_LABEL_LENGTH,
  );
  const hasValidSkills =
    totalSkills > 0
    && totalSkills <= SKILLS_HUNT_MAX_SKILLS_PER_SUBMISSION
    && proposedSkills.length <= SKILLS_HUNT_MAX_PROPOSED_SKILLS_PER_SUBMISSION
    && allSkillsWithinLabelLimit;

  const hasValidClaimedProfessions = claimedProfessions.length <= 20;
  const hasUnsafeText = hasUnsafeCollectionText([
    displayName, bio, ...skills, ...proposedSkills, ...claimedProfessions,
  ]);

  return hasValidRoundId
    && hasValidDisplayName
    && hasValidBio
    && hasValidUrl
    && hasValidSkills
    && hasValidClaimedProfessions
    && !hasUnsafeText;
}

export function validateReviewInput(input: SkillsHuntSubmissionReviewInput): boolean {
  const notes = normalizeNullableText(input.notes);
  const validAction = ['accept', 'reject', 'edit', 'flag'].includes(input.action);

  return validAction
    && (!notes || notes.length <= SKILLS_HUNT_MAX_REVIEW_NOTES_LENGTH)
    && (!notes || !containsUnsafeText(notes));
}

export function validateFeatureRewardCardInput(input: SkillsHuntFeatureRewardCardInput): boolean {
  const title = normalizeText(input.title ?? '');
  const description = normalizeText(input.description ?? '');
  const ctaLabel = normalizeText(input.ctaLabel ?? '');
  const ctaUrl = normalizeText(input.ctaUrl ?? '');

  return isLengthInRange(title, 1, 160)
    && isLengthInRange(description, 1, 500)
    && isLengthInRange(ctaLabel, 1, 80)
    && isLengthInRange(ctaUrl, 1, 512)
    && typeof input.isActive === 'boolean';
}

async function getRoundById(client: PoolClient, roundId: string): Promise<SkillsHuntRoundRow | null> {
  const result = await client.query<SkillsHuntRoundRow>(
    `
      SELECT
        id,
        name,
        description,
        status,
        starts_at,
        ends_at,
        scoring_config,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      FROM skills_hunt_rounds
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [roundId],
  );

  return result.rows[0] ?? null;
}

async function ensureSubmissionWindow(client: PoolClient, roundId: string): Promise<void> {
  const round = await getRoundById(client, roundId);
  if (!round) {
    throw new Error('skills_hunt_round_not_found');
  }

  const now = Date.now();
  if (round.status !== 'active' || now < round.starts_at.getTime() || now > round.ends_at.getTime()) {
    throw new Error('skills_hunt_round_not_active');
  }
}

// Reputation-aware submission gate (Wave 2 spec §6.2). Resolves the user's
// tier from lifetime accept/reject stats and weekly usage.
//   - tier 'restricted' (sample ≥ 5 AND rejection rate > 20%)
//   - tier 'trusted'    (sample ≥ 5 AND acceptance rate ≥ 80%) → 10/wk
//   - tier 'standard'   (sample ≥ 5 but not yet trusted)       → 3/wk
//   - tier 'new'        (sample < 5)                            → 3/wk
async function computeReputationProfile(
  client: PoolClient,
  userId: string,
): Promise<SkillsHuntReputationProfile> {
  const usageResult = await client.query<CountRow>(
    `SELECT COUNT(*)::text AS total FROM skills_hunt_submissions
     WHERE submitter_user_id = $1
       AND created_at >= NOW() - INTERVAL '7 days'
       AND deleted_at IS NULL`,
    [userId],
  );
  const rolling7dCount = Number.parseInt(usageResult.rows[0]?.total ?? '0', 10);

  const reviewedResult = await client.query<{
    total: string; accepted: string; rejected: string; pending: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE reviewed_at IS NOT NULL)::text AS total,
       COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted,
       COUNT(*) FILTER (WHERE status = 'rejected')::text AS rejected,
       COUNT(*) FILTER (WHERE status = 'pending')::text AS pending
     FROM skills_hunt_submissions
     WHERE submitter_user_id = $1
       AND deleted_at IS NULL`,
    [userId],
  );

  const reviewedCount = Number.parseInt(reviewedResult.rows[0]?.total ?? '0', 10);
  const acceptedCount = Number.parseInt(reviewedResult.rows[0]?.accepted ?? '0', 10);
  const rejectedCount = Number.parseInt(reviewedResult.rows[0]?.rejected ?? '0', 10);
  const pendingCount = Number.parseInt(reviewedResult.rows[0]?.pending ?? '0', 10);
  const acceptanceRate = reviewedCount > 0 ? acceptedCount / reviewedCount : null;
  const rejectionRate = reviewedCount > 0 ? rejectedCount / reviewedCount : null;

  let tier: SkillsHuntReputationProfile['tier'] = 'new';
  let rolling7dLimit: number = SKILLS_HUNT_REPUTATION.newUserSubmissionLimit7d;

  if (
    reviewedCount >= SKILLS_HUNT_REPUTATION.preApprovalMinSampleSize &&
    rejectionRate !== null &&
    rejectionRate > SKILLS_HUNT_REPUTATION.preApprovalRejectionRateThreshold
  ) {
    tier = 'restricted';
  } else if (
    reviewedCount >= SKILLS_HUNT_REPUTATION.trustedMinSampleSize &&
    acceptanceRate !== null &&
    acceptanceRate >= SKILLS_HUNT_REPUTATION.trustedAcceptanceRateThreshold
  ) {
    tier = 'trusted';
    rolling7dLimit = SKILLS_HUNT_REPUTATION.trustedUserSubmissionLimit7d;
  } else if (reviewedCount >= SKILLS_HUNT_REPUTATION.trustedMinSampleSize) {
    tier = 'standard';
  }

  return {
    userId,
    tier,
    acceptedCount,
    rejectedCount,
    pendingCount,
    rolling7dCount,
    rolling7dLimit,
    acceptanceRate,
    preApprovalRequired: tier === 'restricted',
  };
}

async function ensureSubmissionRateLimits(client: PoolClient, userId: string): Promise<SkillsHuntReputationProfile> {
  const profile = await computeReputationProfile(client, userId);

  if (profile.preApprovalRequired) {
    throw new Error('skills_hunt_pre_approval_required');
  }

  if (profile.rolling7dCount >= profile.rolling7dLimit) {
    throw new Error('skills_hunt_submission_limit_exceeded');
  }

  // Belt-and-braces: keep the legacy rejection-rate guard on the most recent
  // sample. Wave 2 reputation supersedes the lifetime >20% gate, but the
  // sample-based check still catches rapid degradation that lifetime stats
  // haven't caught up to yet.
  const reviewedCount = profile.acceptedCount + profile.rejectedCount;
  if (reviewedCount >= SKILLS_HUNT_REJECTION_GUARD_SAMPLE_SIZE) {
    const recent = await client.query<{ total: string; rejected: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status = 'rejected')::text AS rejected
       FROM (
         SELECT status FROM skills_hunt_submissions
         WHERE submitter_user_id = $1
           AND reviewed_at IS NOT NULL
           AND deleted_at IS NULL
         ORDER BY reviewed_at DESC LIMIT $2
       ) sampled`,
      [userId, SKILLS_HUNT_REJECTION_GUARD_SAMPLE_SIZE],
    );
    const sampledTotal = Number.parseInt(recent.rows[0]?.total ?? '0', 10);
    const sampledRejected = Number.parseInt(recent.rows[0]?.rejected ?? '0', 10);
    if (sampledTotal >= SKILLS_HUNT_REJECTION_GUARD_SAMPLE_SIZE) {
      const rate = sampledRejected / sampledTotal;
      if (rate >= SKILLS_HUNT_REJECTION_GUARD_THRESHOLD) {
        throw new Error('skills_hunt_rejection_guard_violation');
      }
    }
  }

  return profile;
}

export async function getReputationProfile(userId: string): Promise<SkillsHuntReputationProfile> {
  return withDbTransaction((client) => computeReputationProfile(client, userId));
}

async function insertNotification(
  client: PoolClient,
  userId: string,
  kind: string,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await client.query(
    `
      INSERT INTO skills_hunt_notifications (user_id, kind, title, body, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [userId, kind, title, body, JSON.stringify(metadata)],
  );
}

async function ensureAchievement(
  client: PoolClient,
  userId: string,
  code: string,
  title: string,
  description: string,
  roundId: string | null = null,
): Promise<{ awarded: boolean }> {
  // UNIQUE (user_id, code) is preserved per Phase 1 schema notes; round_id is
  // recorded for forensics / Wave 2 per-round badge refactor.
  // Returns awarded=true only on the actual INSERT — callers fan out a
  // notification only on the first award, not on subsequent no-op upserts.
  const result = await client.query(
    `
      INSERT INTO skills_hunt_achievements (user_id, code, title, description, round_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, code)
      DO NOTHING
      RETURNING id
    `,
    [userId, code, title, description, roundId],
  );
  const awarded = (result.rowCount ?? 0) > 0;
  if (awarded) {
    await emitAchievementUnlocked(client, userId, code, title, description);
  }
  return { awarded };
}

// 5 named badges (continuity §6 Wave 2 + design SkillsHunt.tsx BADGES).
// Codes are stable identifiers; titles/descriptions are UI copy.
const NAMED_BADGES = {
  firstFinder: {
    code: 'first-finder',
    title: 'First Finder',
    description: 'First accepted submission for a given Quora URL in a round.',
  },
  diversityChampion: {
    code: 'diversity-champion',
    title: 'Diversity Champion',
    description: 'Skills spanning 3+ sectors across accepted submissions.',
  },
  rareTalentScout: {
    code: 'rare-talent-scout',
    title: 'Rare Talent Scout',
    description: 'Found 3+ accepted submissions tagged with rare skills.',
  },
  qualityContributor: {
    code: 'quality-contributor',
    title: 'Quality Contributor',
    description: '100% acceptance rate with 5+ submissions.',
  },
  // leaderboard-champion fires on round close (top-3 final standings).
  // Wired separately when the round-close handler lands; not awarded here.
  leaderboardChampion: {
    code: 'leaderboard-champion',
    title: 'Leaderboard Champion',
    description: 'Finished top-3 on a round’s final standings.',
  },
} as const;

async function awardNamedBadges(
  client: PoolClient,
  userId: string,
  roundId: string,
  scoreBreakdown: Record<string, unknown>,
): Promise<void> {
  // first-finder — this submission's score includes the firstMatchBonus.
  const firstMatchBonus = scoreBreakdown.firstMatchBonus;
  if (typeof firstMatchBonus === 'number' && firstMatchBonus > 0) {
    await ensureAchievement(
      client, userId,
      NAMED_BADGES.firstFinder.code, NAMED_BADGES.firstFinder.title, NAMED_BADGES.firstFinder.description,
      roundId,
    );
  }

  // rare-talent-scout — 3+ accepted submissions tagged with rare skills.
  // "tagged with rare skills" = score_breakdown.rareSkillBonus > 0.
  const rareCountResult = await client.query<CountRow>(
    `
      SELECT COUNT(*)::text AS total
      FROM skills_hunt_submissions
      WHERE submitter_user_id = $1
        AND status = 'accepted'
        AND deleted_at IS NULL
        AND COALESCE((score_breakdown ->> 'rareSkillBonus')::int, 0) > 0
    `,
    [userId],
  );
  const rareCount = Number.parseInt(rareCountResult.rows[0]?.total ?? '0', 10);
  if (rareCount >= 3) {
    await ensureAchievement(
      client, userId,
      NAMED_BADGES.rareTalentScout.code, NAMED_BADGES.rareTalentScout.title, NAMED_BADGES.rareTalentScout.description,
      roundId,
    );
  }

  // diversity-champion — accepted submissions spanning 3+ distinct claimed
  // professions. claimed_professions is a JSONB array, so we unnest into rows.
  const diversityResult = await client.query<{ total: string }>(
    `
      SELECT COUNT(DISTINCT prof)::text AS total
      FROM (
        SELECT jsonb_array_elements_text(claimed_professions) AS prof
        FROM skills_hunt_submissions
        WHERE submitter_user_id = $1
          AND status = 'accepted'
          AND deleted_at IS NULL
          AND jsonb_typeof(claimed_professions) = 'array'
      ) p
    `,
    [userId],
  );
  const distinctProfessionCount = Number.parseInt(diversityResult.rows[0]?.total ?? '0', 10);
  if (distinctProfessionCount >= 3) {
    await ensureAchievement(
      client, userId,
      NAMED_BADGES.diversityChampion.code, NAMED_BADGES.diversityChampion.title, NAMED_BADGES.diversityChampion.description,
      roundId,
    );
  }

  // quality-contributor — 100% acceptance rate with 5+ accepted submissions.
  // 100% rate = accepted >= 5 AND rejected = 0. Edits still count as accepted.
  const qualityResult = await client.query<{ accepted: string; rejected: string }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')::text AS rejected
      FROM skills_hunt_submissions
      WHERE submitter_user_id = $1
        AND deleted_at IS NULL
    `,
    [userId],
  );
  const acceptedCount = Number.parseInt(qualityResult.rows[0]?.accepted ?? '0', 10);
  const rejectedCount = Number.parseInt(qualityResult.rows[0]?.rejected ?? '0', 10);
  if (acceptedCount >= 5 && rejectedCount === 0) {
    await ensureAchievement(
      client, userId,
      NAMED_BADGES.qualityContributor.code, NAMED_BADGES.qualityContributor.title, NAMED_BADGES.qualityContributor.description,
      roundId,
    );
  }
}

export async function rebuildLeaderboard(client: PoolClient, roundId: string): Promise<void> {
  await client.query(
    'DELETE FROM skills_hunt_leaderboard WHERE round_id = $1::uuid',
    [roundId],
  );

  // Spec tie-break: score DESC, first_match_count DESC, last_submission_at ASC.
  // first_match_count = accepted submissions where firstMatchBonus > 0.
  // last_submission_at = MAX(created_at) across all statuses, drives "ties go
  // to the scout who showed up earliest".
  // pending_points = a rough preview of points-in-flight if every pending
  // submission accepts at SPEC matchBase (+10). Cheap lower bound; UI shows
  // it as "+N pending" next to the score.
  const individualRows = await client.query<{
    submitter_user_id: string;
    submitter_username: string | null;
    score: string;
    accepted_count: string;
    rare_skill_bonus: string;
    first_match_count: string;
    pending_points: string;
    last_submission_at: Date | null;
  }>(
    `
      WITH accepted AS (
        SELECT
          submitter_user_id,
          MAX(submitter_username) AS submitter_username,
          SUM(points_awarded)::text AS score,
          COUNT(*)::text AS accepted_count,
          SUM(COALESCE((score_breakdown->>'rareSkillBonus')::int, 0))::text AS rare_skill_bonus,
          COUNT(*) FILTER (
            WHERE COALESCE((score_breakdown->>'firstMatchBonus')::int, 0) > 0
          )::text AS first_match_count
        FROM skills_hunt_submissions
        WHERE round_id = $1::uuid AND status = 'accepted' AND deleted_at IS NULL
        GROUP BY submitter_user_id
      ),
      pending AS (
        SELECT
          submitter_user_id,
          (COUNT(*) * $2)::text AS pending_points
        FROM skills_hunt_submissions
        WHERE round_id = $1::uuid AND status = 'pending' AND deleted_at IS NULL
        GROUP BY submitter_user_id
      ),
      activity AS (
        -- Spec tie-break: "ties go to the earliest scout to submit". We use
        -- MIN(created_at) here and ORDER BY ASC at the consumer so the row
        -- with the oldest first-touch wins. The column name is kept for
        -- backwards compatibility with existing consumers.
        SELECT
          submitter_user_id,
          MIN(created_at) AS last_submission_at
        FROM skills_hunt_submissions
        WHERE round_id = $1::uuid AND deleted_at IS NULL
        GROUP BY submitter_user_id
      )
      SELECT
        a.submitter_user_id,
        a.submitter_username,
        a.score,
        a.accepted_count,
        a.rare_skill_bonus,
        a.first_match_count,
        COALESCE(p.pending_points, '0') AS pending_points,
        act.last_submission_at
      FROM accepted a
      LEFT JOIN pending p ON p.submitter_user_id = a.submitter_user_id
      LEFT JOIN activity act ON act.submitter_user_id = a.submitter_user_id
      ORDER BY
        a.score::int DESC,
        a.first_match_count::int DESC,
        act.last_submission_at ASC NULLS LAST,
        a.submitter_user_id ASC
    `,
    [roundId, SKILLS_HUNT_SCORE_WEIGHTS_SPEC.matchBase],
  );

  for (let index = 0; index < individualRows.rows.length; index += 1) {
    const row = individualRows.rows[index];
    await client.query(
      `
        INSERT INTO skills_hunt_leaderboard
          (round_id, mode, rank, score, accepted_count, rare_skill_bonus,
           first_match_count, pending_points, last_submission_at,
           user_id, username_snapshot, team_key, metadata)
        VALUES
          ($1::uuid, 'individual', $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, NULL, '{}'::jsonb)
      `,
      [
        roundId,
        index + 1,
        Number.parseInt(row.score, 10),
        Number.parseInt(row.accepted_count, 10),
        Number.parseInt(row.rare_skill_bonus, 10),
        Number.parseInt(row.first_match_count, 10),
        Number.parseInt(row.pending_points, 10),
        row.last_submission_at,
        row.submitter_user_id,
        row.submitter_username,
      ],
    );
  }

  const teamRows = await client.query<{
    team_key: string;
    score: string;
    accepted_count: string;
    rare_skill_bonus: string;
    first_match_count: string;
    last_submission_at: Date | null;
  }>(
    `
      SELECT
        LOWER(TRIM(COALESCE(profession.value, 'unspecified'))) AS team_key,
        SUM(s.points_awarded)::text AS score,
        COUNT(*)::text AS accepted_count,
        SUM(COALESCE((s.score_breakdown->>'rareSkillBonus')::int, 0))::text AS rare_skill_bonus,
        COUNT(*) FILTER (
          WHERE COALESCE((s.score_breakdown->>'firstMatchBonus')::int, 0) > 0
        )::text AS first_match_count,
        -- Earliest-scout-wins tie-break (see comment in individual CTE).
        MIN(s.created_at) AS last_submission_at
      FROM skills_hunt_submissions s
      LEFT JOIN LATERAL jsonb_array_elements_text(s.claimed_professions) profession(value) ON TRUE
      WHERE s.round_id = $1::uuid AND s.status = 'accepted' AND s.deleted_at IS NULL
      GROUP BY LOWER(TRIM(COALESCE(profession.value, 'unspecified')))
      ORDER BY
        SUM(s.points_awarded) DESC,
        COUNT(*) FILTER (WHERE COALESCE((s.score_breakdown->>'firstMatchBonus')::int, 0) > 0) DESC,
        MIN(s.created_at) ASC NULLS LAST,
        team_key ASC
    `,
    [roundId],
  );

  for (let index = 0; index < teamRows.rows.length; index += 1) {
    const row = teamRows.rows[index];
    await client.query(
      `
        INSERT INTO skills_hunt_leaderboard
          (round_id, mode, rank, score, accepted_count, rare_skill_bonus,
           first_match_count, pending_points, last_submission_at,
           user_id, username_snapshot, team_key, metadata)
        VALUES
          ($1::uuid, 'team', $2, $3, $4, $5, $6, 0, $7::timestamptz, NULL, NULL, $8, '{}'::jsonb)
      `,
      [
        roundId,
        index + 1,
        Number.parseInt(row.score, 10),
        Number.parseInt(row.accepted_count, 10),
        Number.parseInt(row.rare_skill_bonus, 10),
        Number.parseInt(row.first_match_count, 10),
        row.last_submission_at,
        row.team_key,
      ],
    );
  }
}

// Effective per-submission scoring weights = SPEC defaults + per-round overrides.
// Per-round overrides live in `skills_hunt_rounds.scoring_config` so an admin
// can promote/dampen rewards mid-program without code change.
// Explicit number-typed shape (not `typeof SKILLS_HUNT_SCORE_WEIGHTS_SPEC`)
// because the spec object is `as const` and its literal types would reject
// per-round overrides stored on the round.
type ResolvedScoreWeights = {
  -readonly [K in keyof typeof SKILLS_HUNT_SCORE_WEIGHTS_SPEC]: number;
};

function resolveScoreWeights(scoringConfig: unknown): ResolvedScoreWeights {
  const overrides = scoringConfig && typeof scoringConfig === 'object' && !Array.isArray(scoringConfig)
    ? (scoringConfig as Record<string, unknown>)
    : {};

  const pickInt = (key: keyof ResolvedScoreWeights): number => {
    const raw = overrides[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
    return SKILLS_HUNT_SCORE_WEIGHTS_SPEC[key];
  };

  return {
    matchBase: pickInt('matchBase'),
    firstMatchBonus: pickInt('firstMatchBonus'),
    stackBonus: pickInt('stackBonus'),
    stackBonusProfessionThreshold: pickInt('stackBonusProfessionThreshold'),
    rareSkillBonus: pickInt('rareSkillBonus'),
    qualityBonus: pickInt('qualityBonus'),
    participationOnReject: pickInt('participationOnReject'),
  };
}

async function scoreSubmission(
  client: PoolClient,
  submissionId: string,
  reviewAction: 'accept' | 'edit',
): Promise<{ pointsAwarded: number; scoreBreakdown: Record<string, unknown> }> {
  const submissionResult = await client.query<{
    id: string;
    round_id: string;
    quora_profile_url_normalized: string;
    skills: unknown;
    claimed_professions: unknown;
    bio: string;
  }>(
    `
      SELECT id, round_id, quora_profile_url_normalized, skills, claimed_professions, bio
      FROM skills_hunt_submissions
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [submissionId],
  );

  const submission = submissionResult.rows[0];
  if (!submission) {
    throw new Error('skills_hunt_submission_not_found');
  }

  const skills = asStringArray(submission.skills);
  const claimedProfessions = asStringArray(submission.claimed_professions);

  const roundResult = await client.query<{ scoring_config: unknown }>(
    `SELECT scoring_config FROM skills_hunt_rounds WHERE id = $1::uuid LIMIT 1`,
    [submission.round_id],
  );
  const weights = resolveScoreWeights(roundResult.rows[0]?.scoring_config ?? null);

  // Match (+10 flat per spec): unconditional on acceptance. Replaces the
  // pre-rewrite `min(skills.length, 5) * 3` per-skill scaling.
  const matchBase = weights.matchBase;

  // First Match (+5): only the first scout to land an accepted submission
  // for a given normalized URL in this round gets the bonus.
  const firstMatchResult = await client.query<CountRow>(
    `
      SELECT COUNT(*)::text AS total
      FROM skills_hunt_submissions
      WHERE round_id = $1::uuid
        AND status = 'accepted'
        AND quora_profile_url_normalized = $2
        AND id <> $3::uuid
    `,
    [submission.round_id, submission.quora_profile_url_normalized, submission.id],
  );
  const acceptedSameUrlCount = Number.parseInt(firstMatchResult.rows[0]?.total ?? '0', 10);
  const firstMatchBonus = acceptedSameUrlCount === 0 ? weights.firstMatchBonus : 0;

  // Skill Stack (+3): only when 2+ professions are claimed. Replaces the
  // pre-rewrite linear `count * 2`.
  const stackBonus = claimedProfessions.length >= weights.stackBonusProfessionThreshold ? weights.stackBonus : 0;

  // Rare Skill (+7 default): driven by `skills_hunt_rare_skills_lookup`,
  // which the Workforce snapshot helper repopulates at round-create time.
  // Per-skill row may override the default bonus.
  const rareSkillRows = await client.query<{ skill_name: string; bonus_points: number | null }>(
    `
      SELECT skill_name, bonus_points
      FROM skills_hunt_rare_skills_lookup
      WHERE round_id = $1::uuid
    `,
    [submission.round_id],
  );
  const rareLookup = new Map(
    rareSkillRows.rows.map((row) => [normalizeText(row.skill_name).toLowerCase(), row.bonus_points]),
  );
  const rareSkillBonus = skills.reduce((accumulator, skillName) => {
    const normalizedSkill = normalizeText(skillName).toLowerCase();
    if (!rareLookup.has(normalizedSkill)) return accumulator;
    const perSkillBonus = rareLookup.get(normalizedSkill);
    return accumulator + (typeof perSkillBonus === 'number' ? perSkillBonus : weights.rareSkillBonus);
  }, 0);

  // Quality (+2): awarded only when the moderator accepts without editing.
  // The 'edit' action signals admin had to fix something, so quality drops.
  const qualityBonus = reviewAction === 'accept' ? weights.qualityBonus : 0;

  const pointsAwarded = matchBase + firstMatchBonus + stackBonus + rareSkillBonus + qualityBonus;
  const scoreBreakdown = {
    matchBase,
    firstMatchBonus,
    stackBonus,
    rareSkillBonus,
    qualityBonus,
    weightsApplied: weights,
  };

  return { pointsAwarded, scoreBreakdown };
}

async function maybeAutoGenerateDirectoryProfile(
  client: PoolClient,
  actorId: string,
  submissionId: string,
  invitedByUsername: string,
): Promise<void> {
  const existingProjection = await client.query<{ submission_id: string }>(
    'SELECT submission_id FROM skills_hunt_directory_profiles WHERE submission_id = $1::uuid LIMIT 1',
    [submissionId],
  );

  if (existingProjection.rows.length > 0) {
    return;
  }

  const submissionResult = await client.query<{
    id: string;
    display_name: string;
    bio: string;
    quora_profile_url: string;
    claimed_professions: unknown;
  }>(
    `
      SELECT id, display_name, bio, quora_profile_url, claimed_professions
      FROM skills_hunt_submissions
      WHERE id = $1::uuid
        AND status = 'accepted'
      LIMIT 1
    `,
    [submissionId],
  );

  const submission = submissionResult.rows[0];
  if (!submission) {
    throw new Error('skills_hunt_submission_not_found');
  }

  const professions = asStringArray(submission.claimed_professions);
  const headline = professions[0] ?? 'Skills Hunt contributor';

  const insertedDirectoryProfile = await client.query<{ id: string }>(
    `
      INSERT INTO directory_profiles
        (claimed_by_user_id, first_name, headline, bio, profile_url, sector_id, job_title_id, is_active)
      VALUES
        (NULL, $1, $2, $3, $4, NULL, NULL, true)
      RETURNING id
    `,
    [submission.display_name, headline, submission.bio, submission.quora_profile_url],
  );

  const directoryProfileId = insertedDirectoryProfile.rows[0].id;

  await client.query(
    `
      INSERT INTO skills_hunt_directory_profiles
        (submission_id, directory_profile_id, invited_by_username, created_by_user_id, metadata)
      VALUES
        ($1::uuid, $2::uuid, $3, $4, '{"generatedBy":"skills-hunt"}'::jsonb)
    `,
    [submissionId, directoryProfileId, invitedByUsername, actorId],
  );

  await client.query(
    `
      UPDATE skills_hunt_submissions
      SET directory_profile_generated_at = NOW(), updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [submissionId],
  );
}

export async function listRounds(status: SkillsHuntRoundStatus | null): Promise<SkillsHuntRound[]> {
  const params: unknown[] = [];
  const where = status ? 'WHERE status = $1' : '';
  if (status) {
    params.push(status);
  }

  const result = await queryDb<SkillsHuntRoundRow>(
    `
      SELECT
        id,
        name,
        description,
        status,
        starts_at,
        ends_at,
        scoring_config,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      FROM skills_hunt_rounds
      ${where}
      ORDER BY starts_at DESC, created_at DESC
    `,
    params,
  );

  return result.rows.map(mapRound);
}

export async function createRound(actorId: string, input: SkillsHuntRoundInput): Promise<SkillsHuntRound> {
  return withDbTransaction(async (client) => {
    const row = await client.query<SkillsHuntRoundRow>(
      `
        INSERT INTO skills_hunt_rounds
          (name, description, status, starts_at, ends_at, scoring_config, created_by_user_id, updated_by_user_id)
        VALUES
          ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::jsonb, $7, $7)
        RETURNING
          id,
          name,
          description,
          status,
          starts_at,
          ends_at,
          scoring_config,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
      `,
      [
        normalizeText(input.name),
        normalizeNullableText(input.description),
        input.status,
        input.startsAtIso,
        input.endsAtIso,
        JSON.stringify(input.scoringConfig ?? {}),
        actorId,
      ],
    );

    // Snapshot Workforce rare-skill state at round-create. Keeps the
    // Rare Skill bonus stable for the round's lifetime per spec.
    await snapshotRareSkillsForRound(client, row.rows[0].id);

    return mapRound(row.rows[0]);
  });
}

export async function updateRound(actorId: string, roundId: string, input: SkillsHuntRoundInput): Promise<SkillsHuntRound | null> {
  return withDbTransaction(async (client) => {
    const existing = await getRoundById(client, roundId);
    if (!existing) {
      return null;
    }

    const updated = await client.query<SkillsHuntRoundRow>(
      `
        UPDATE skills_hunt_rounds
        SET
          name = $2,
          description = $3,
          status = $4,
          starts_at = $5::timestamptz,
          ends_at = $6::timestamptz,
          scoring_config = $7::jsonb,
          updated_by_user_id = $8,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING
          id,
          name,
          description,
          status,
          starts_at,
          ends_at,
          scoring_config,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
      `,
      [
        roundId,
        normalizeText(input.name),
        normalizeNullableText(input.description),
        input.status,
        input.startsAtIso,
        input.endsAtIso,
        JSON.stringify(input.scoringConfig ?? {}),
        actorId,
      ],
    );

    // Round-close hook: when the admin flips a round from active → closed,
    // award `leaderboard-champion` to the top-3 individual finishers. This is
    // the only place that badge can fire (the recompute helper inside
    // reviewSubmission can't know whether the round has ended).
    if (existing.status === 'active' && input.status === 'closed') {
      const finalTopThree = await client.query<{ user_id: string | null; rank: number }>(
        `
          SELECT user_id, rank
          FROM skills_hunt_leaderboard
          WHERE round_id = $1::uuid
            AND mode = 'individual'
            AND user_id IS NOT NULL
          ORDER BY rank ASC
          LIMIT 3
        `,
        [roundId],
      );
      for (const row of finalTopThree.rows) {
        if (!row.user_id) continue;
        await ensureAchievement(
          client,
          row.user_id,
          NAMED_BADGES.leaderboardChampion.code,
          NAMED_BADGES.leaderboardChampion.title,
          NAMED_BADGES.leaderboardChampion.description,
          roundId,
        );
      }
    }

    return mapRound(updated.rows[0]);
  });
}

export async function createSubmission(
  submitterUserId: string,
  submitterUsername: string | null,
  input: SkillsHuntSubmissionInput,
): Promise<SkillsHuntSubmission> {
  const normalizedUrlForCheck = normalizeQuoraProfileUrl(input.quoraProfileUrl);
  // Defense-in-depth: only allow true Quora hostnames before we make any
  // outbound HEAD request. Rejects look-alikes like evilquora.com or
  // notquora.com.example.
  try {
    const parsedHost = new URL(normalizedUrlForCheck).hostname.toLowerCase();
    if (parsedHost !== 'quora.com' && !parsedHost.endsWith('.quora.com')) {
      throw new Error('skills_hunt_invalid_quora_url');
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'skills_hunt_invalid_quora_url') throw e;
    throw new Error('skills_hunt_invalid_quora_url');
  }
  const liveness = await checkUrlLiveness(normalizedUrlForCheck);
  if (liveness.result === 'dead') {
    throw new Error('skills_hunt_url_dead');
  }

  return withDbTransaction(async (client) => {
    await ensureSubmissionWindow(client, input.roundId);
    await ensureSubmissionRateLimits(client, submitterUserId);

    const normalizedUrl = normalizedUrlForCheck;
    const skills = normalizeArray(input.skills);
    const proposedSkills = normalizeArray(input.proposedSkills ?? []);
    const claimedProfessions = normalizeArray(input.claimedProfessions);
    const signatureHash = buildSignatureHash(normalizedUrl, skills, proposedSkills);

    const inserted = await client.query<SkillsHuntSubmissionRow>(
      `
        INSERT INTO skills_hunt_submissions
          (
            round_id,
            submitter_user_id,
            submitter_username,
            display_name,
            bio,
            quora_profile_url,
            quora_profile_url_normalized,
            skills,
            proposed_skills,
            claimed_professions,
            signature_hash,
            status,
            points_awarded,
            score_breakdown,
            url_validation_result,
            url_validation_checked_at
          )
        VALUES
          ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $13::jsonb, $9::jsonb, $10, 'pending', 0, '{}'::jsonb, $11, $12::timestamptz)
        RETURNING
          id,
          round_id,
          submitter_user_id,
          submitter_username,
          display_name,
          bio,
          quora_profile_url,
          skills,
          proposed_skills,
          claimed_professions,
          status,
          points_awarded,
          participation_points,
          credit_granted,
          score_breakdown,
          review_action,
          review_notes,
          reviewed_by_user_id,
          reviewed_at,
          directory_profile_generated_at,
          created_at,
          updated_at,
          url_validation_result,
          url_validation_checked_at
      `,
      [
        input.roundId,
        submitterUserId,
        submitterUsername,
        normalizeText(input.displayName),
        normalizeText(input.bio),
        normalizedUrl,
        normalizedUrl,
        JSON.stringify(skills),
        JSON.stringify(claimedProfessions),
        signatureHash,
        liveness.result,
        liveness.checkedAtIso,
        JSON.stringify(proposedSkills),
      ],
    );

    await insertNotification(
      client,
      submitterUserId,
      'submission-created',
      'Submission received',
      'Your Skills Hunt submission has been queued for moderation review.',
      { roundId: input.roundId, submissionId: inserted.rows[0].id },
    );

    return mapSubmission(inserted.rows[0]);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'unknown';
    if (message.includes('skills_hunt_round_not_active')) {
      throw new Error('skills_hunt_round_not_active');
    }
    if (message.includes('skills_hunt_round_not_found')) {
      throw new Error('skills_hunt_round_not_found');
    }
    if (message.includes('skills_hunt_submission_limit_exceeded')) {
      throw new Error('skills_hunt_submission_limit_exceeded');
    }
    if (message.includes('skills_hunt_pre_approval_required')) {
      throw new Error('skills_hunt_pre_approval_required');
    }
    if (message.includes('skills_hunt_rejection_guard_violation')) {
      throw new Error('skills_hunt_rejection_guard_violation');
    }
    if (message.includes('skills_hunt_invalid_quora_url')) {
      throw new Error('skills_hunt_invalid_quora_url');
    }
    if (message.includes('skills_hunt_url_dead')) {
      throw new Error('skills_hunt_url_dead');
    }
    if (message.includes('skills_hunt_submissions_round_id_signature_hash_key')) {
      throw new Error('skills_hunt_duplicate_submission');
    }
    throw error;
  });
}

export async function listSubmissions(
  roundId: string,
  status: string | null,
  pagination: SkillsHuntPagination,
  access: { userId: string; isModeratorOrAdmin: boolean },
): Promise<{ items: SkillsHuntSubmission[]; pagination: SkillsHuntPagination; total: number }> {
  const params: unknown[] = [roundId];
  let filterSql = '';

  if (status) {
    params.push(status);
    filterSql += ` AND status = $${params.length}`;
  }

  if (!access.isModeratorOrAdmin) {
    params.push(access.userId);
    filterSql += ` AND submitter_user_id = $${params.length}`;
  }

  params.push(pagination.pageSize);
  params.push((pagination.page - 1) * pagination.pageSize);

  const listSql = `
    SELECT
      id,
      round_id,
      submitter_user_id,
      submitter_username,
      display_name,
      bio,
      quora_profile_url,
      skills,
      proposed_skills,
      claimed_professions,
      status,
      points_awarded,
      participation_points,
      credit_granted,
      url_validation_result,
      url_validation_checked_at,
      score_breakdown,
      review_action,
      review_notes,
      reviewed_by_user_id,
      reviewed_at,
      edit_history,
      edited_at,
      deleted_at,
      directory_profile_generated_at,
      created_at,
      updated_at
    FROM skills_hunt_submissions
    WHERE round_id = $1::uuid
      AND deleted_at IS NULL
      ${filterSql}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;

  const totalParams = params.slice(0, params.length - 2);
  const totalSql = `
    SELECT COUNT(*)::text AS total
    FROM skills_hunt_submissions
    WHERE round_id = $1::uuid
      AND deleted_at IS NULL
      ${filterSql}
  `;

  const [itemsResult, totalResult] = await Promise.all([
    queryDb<SkillsHuntSubmissionRow>(listSql, params),
    queryDb<CountRow>(totalSql, totalParams),
  ]);

  return {
    items: itemsResult.rows.map(mapSubmission),
    pagination,
    total: Number.parseInt(totalResult.rows[0]?.total ?? '0', 10),
  };
}

export async function reviewSubmission(
  actorId: string,
  actorUsername: string | null,
  submissionId: string,
  input: SkillsHuntSubmissionReviewInput,
): Promise<SkillsHuntSubmission> {
  return withDbTransaction(async (client) => {
    const submissionResult = await client.query<SkillsHuntSubmissionRow>(
      `
        SELECT
          id,
          round_id,
          submitter_user_id,
          submitter_username,
          display_name,
          bio,
          quora_profile_url,
          skills,
          claimed_professions,
          status,
          points_awarded,
          score_breakdown,
          review_action,
          review_notes,
          reviewed_by_user_id,
          reviewed_at,
          directory_profile_generated_at,
          created_at,
          updated_at
        FROM skills_hunt_submissions
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [submissionId],
    );

    const existing = submissionResult.rows[0];
    if (!existing) {
      throw new Error('skills_hunt_submission_not_found');
    }

    let status: SkillsHuntSubmission['status'] = existing.status;
    let pointsAwarded = existing.points_awarded;
    let scoreBreakdown = normalizeJsonObject(existing.score_breakdown);
    let participationPoints = 0;

    if (input.action === 'accept' || input.action === 'edit') {
      const scored = await scoreSubmission(client, submissionId, input.action);
      pointsAwarded = scored.pointsAwarded;
      scoreBreakdown = scored.scoreBreakdown;
      status = 'accepted';
    }

    if (input.action === 'reject') {
      // Reputation system (Wave 2 spec §6.2): rejected submitters still
      // earn +1 participation point so scouting attempts aren't punished
      // beyond the rejection-rate guardrail.
      const rejectWeights = resolveScoreWeights(
        (await client.query<{ scoring_config: unknown }>(
          `SELECT scoring_config FROM skills_hunt_rounds WHERE id = $1::uuid LIMIT 1`,
          [existing.round_id],
        )).rows[0]?.scoring_config ?? null,
      );
      status = 'rejected';
      pointsAwarded = 0;
      participationPoints = rejectWeights.participationOnReject;
      scoreBreakdown = { rejected: true, participationPoints };
    }

    if (input.action === 'flag') {
      status = 'flagged';
      pointsAwarded = 0;
      scoreBreakdown = { flagged: true };
    }

    const updated = await client.query<SkillsHuntSubmissionRow>(
      `
        UPDATE skills_hunt_submissions
        SET
          status = $2,
          review_action = $3,
          review_notes = $4,
          reviewed_by_user_id = $5,
          reviewed_at = NOW(),
          points_awarded = $6,
          score_breakdown = $7::jsonb,
          participation_points = $8,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING
          id,
          round_id,
          submitter_user_id,
          submitter_username,
          display_name,
          bio,
          quora_profile_url,
          skills,
          proposed_skills,
          claimed_professions,
          status,
          points_awarded,
          participation_points,
          credit_granted,
          url_validation_result,
          url_validation_checked_at,
          score_breakdown,
          review_action,
          review_notes,
          reviewed_by_user_id,
          reviewed_at,
          edit_history,
          edited_at,
          deleted_at,
          directory_profile_generated_at,
          created_at,
          updated_at
      `,
      [
        submissionId,
        status,
        input.action,
        normalizeNullableText(input.notes),
        actorId,
        pointsAwarded,
        JSON.stringify(scoreBreakdown),
        participationPoints,
      ],
    );

    // Capture top-10 before the rebuild so we can diff and fan out
    // emitLeaderboardTopTen() for anyone newly inside the cap.
    const topTenBefore = new Set(await captureTopTenUserIds(client, existing.round_id));

    await rebuildLeaderboard(client, existing.round_id);

    const topTenAfter = await readCurrentTopTen(client, existing.round_id);
    for (const entry of topTenAfter) {
      if (!topTenBefore.has(entry.userId)) {
        await emitLeaderboardTopTen(client, entry.userId, existing.round_id, entry.rank, entry.score);
      }
    }

    if (status === 'accepted') {
      // Only fan out the acceptance notification on an actual transition into
      // `accepted` — re-reviewing an already-accepted submission (accept/edit)
      // must not spam duplicate inbox entries for the same submission.
      if (existing.status !== 'accepted') {
        await emitSubmissionAccepted(client, existing.submitter_user_id, submissionId, pointsAwarded);
      }

      await awardNamedBadges(client, existing.submitter_user_id, existing.round_id, scoreBreakdown);

      // Mission progress recompute on accept — newlyCompleted gives us the
      // missions that crossed the goal threshold for the user in this
      // transaction; fan out one mission-complete notification each.
      const { newlyCompleted } = await recomputeMissionProgressForUser(
        client,
        existing.round_id,
        existing.submitter_user_id,
      );
      for (const mission of newlyCompleted) {
        await emitMissionComplete(
          client,
          existing.submitter_user_id,
          mission.id,
          mission.title,
          mission.bonusPoints,
        );
      }

      const attributionUsername = existing.submitter_username ?? actorUsername ?? 'system';
      await maybeAutoGenerateDirectoryProfile(client, actorId, submissionId, attributionUsername);
    }

    if (status === 'rejected') {
      await emitSubmissionRejected(client, existing.submitter_user_id, submissionId);
    }

    // If an already-accepted submission was flipped to reject/flag, mission
    // progress for this user may need to roll back. recomputeMissionProgressForUser
    // is idempotent and reads only currently-accepted rows, so the simple
    // path is to call it on any accepted → non-accepted transition.
    if (existing.status === 'accepted' && status !== 'accepted') {
      const { newlyCompleted } = await recomputeMissionProgressForUser(
        client,
        existing.round_id,
        existing.submitter_user_id,
      );
      for (const mission of newlyCompleted) {
        await emitMissionComplete(
          client,
          existing.submitter_user_id,
          mission.id,
          mission.title,
          mission.bonusPoints,
        );
      }
    }

    return mapSubmission(updated.rows[0]);
  });
}

const LEADERBOARD_TOP_CAP = 100;

const LEADERBOARD_SELECT = `
  rank, score, accepted_count, rare_skill_bonus,
  first_match_count, pending_points, last_submission_at,
  user_id, username_snapshot, team_key, metadata
`;

export async function listLeaderboard(
  roundId: string,
  mode: SkillsHuntLeaderboardMode,
  viewerUserId: string | null = null,
): Promise<{ items: SkillsHuntLeaderboardItem[]; currentUserEntry: SkillsHuntLeaderboardItem | null; totalCount: number }> {
  const rows = await queryDb<SkillsHuntLeaderboardRow>(
    `
      SELECT ${LEADERBOARD_SELECT}
      FROM skills_hunt_leaderboard
      WHERE round_id = $1::uuid AND mode = $2
      ORDER BY rank ASC
      LIMIT $3
    `,
    [roundId, mode, LEADERBOARD_TOP_CAP],
  );

  const totalResult = await queryDb<CountRow>(
    `SELECT COUNT(*)::text AS total FROM skills_hunt_leaderboard WHERE round_id = $1::uuid AND mode = $2`,
    [roundId, mode],
  );
  const totalCount = Number.parseInt(totalResult.rows[0]?.total ?? '0', 10);

  let currentUserEntry: SkillsHuntLeaderboardItem | null = null;
  if (viewerUserId && mode === 'individual') {
    const inTopCap = rows.rows.find((r) => r.user_id === viewerUserId);
    if (inTopCap) {
      currentUserEntry = mapLeaderboard(inTopCap);
    } else {
      const userRow = await queryDb<SkillsHuntLeaderboardRow>(
        `
          SELECT ${LEADERBOARD_SELECT}
          FROM skills_hunt_leaderboard
          WHERE round_id = $1::uuid AND mode = 'individual' AND user_id = $2
          LIMIT 1
        `,
        [roundId, viewerUserId],
      );
      if (userRow.rows.length > 0) currentUserEntry = mapLeaderboard(userRow.rows[0]);
    }
  }

  return { items: rows.rows.map(mapLeaderboard), currentUserEntry, totalCount };
}

// All-time view: aggregates accepted submissions across every round. Read-only
// derivation — no rows are materialized into skills_hunt_leaderboard with a
// sentinel round_id (cheaper to recompute on read at this scale).
export async function listAllTimeLeaderboard(
  mode: SkillsHuntLeaderboardMode,
  viewerUserId: string | null = null,
): Promise<{ items: SkillsHuntLeaderboardItem[]; currentUserEntry: SkillsHuntLeaderboardItem | null; totalCount: number }> {
  const orderTail = `
    ORDER BY
      score::int DESC,
      first_match_count::int DESC,
      last_submission_at ASC NULLS LAST,
      identity ASC
  `;

  type AggRow = {
    identity: string;
    submitter_username: string | null;
    score: string;
    accepted_count: string;
    rare_skill_bonus: string;
    first_match_count: string;
    last_submission_at: Date | null;
  };

  const sqlIndividual = `
    WITH agg AS (
      SELECT
        submitter_user_id AS identity,
        MAX(submitter_username) AS submitter_username,
        SUM(points_awarded)::text AS score,
        COUNT(*)::text AS accepted_count,
        SUM(COALESCE((score_breakdown->>'rareSkillBonus')::int, 0))::text AS rare_skill_bonus,
        COUNT(*) FILTER (
          WHERE COALESCE((score_breakdown->>'firstMatchBonus')::int, 0) > 0
        )::text AS first_match_count,
        MIN(created_at) AS last_submission_at
      FROM skills_hunt_submissions
      WHERE status = 'accepted' AND deleted_at IS NULL
      GROUP BY submitter_user_id
    )
    SELECT * FROM agg
    ${orderTail}
  `;

  const sqlTeam = `
    WITH agg AS (
      SELECT
        LOWER(TRIM(COALESCE(profession.value, 'unspecified'))) AS identity,
        NULL::text AS submitter_username,
        SUM(s.points_awarded)::text AS score,
        COUNT(*)::text AS accepted_count,
        SUM(COALESCE((s.score_breakdown->>'rareSkillBonus')::int, 0))::text AS rare_skill_bonus,
        COUNT(*) FILTER (
          WHERE COALESCE((s.score_breakdown->>'firstMatchBonus')::int, 0) > 0
        )::text AS first_match_count,
        MIN(s.created_at) AS last_submission_at
      FROM skills_hunt_submissions s
      LEFT JOIN LATERAL jsonb_array_elements_text(s.claimed_professions) profession(value) ON TRUE
      WHERE s.status = 'accepted' AND s.deleted_at IS NULL
      GROUP BY LOWER(TRIM(COALESCE(profession.value, 'unspecified')))
    )
    SELECT * FROM agg
    ${orderTail}
  `;

  const result = await queryDb<AggRow>(mode === 'team' ? sqlTeam : sqlIndividual, []);
  const totalCount = result.rows.length;

  const toItem = (row: AggRow, rank: number): SkillsHuntLeaderboardItem => ({
    rank,
    score: Number.parseInt(row.score, 10),
    acceptedCount: Number.parseInt(row.accepted_count, 10),
    firstMatchCount: Number.parseInt(row.first_match_count, 10),
    pendingPoints: 0,
    rareSkillBonus: Number.parseInt(row.rare_skill_bonus, 10),
    userId: mode === 'individual' ? row.identity : null,
    usernameSnapshot: row.submitter_username,
    teamKey: mode === 'team' ? row.identity : null,
    lastSubmissionAtIso: row.last_submission_at ? toIso(row.last_submission_at) : null,
    metadata: {},
  });

  const items = result.rows.slice(0, LEADERBOARD_TOP_CAP).map((row, index) => toItem(row, index + 1));

  let currentUserEntry: SkillsHuntLeaderboardItem | null = null;
  if (viewerUserId && mode === 'individual') {
    const userIndex = result.rows.findIndex((r) => r.identity === viewerUserId);
    if (userIndex >= 0) currentUserEntry = toItem(result.rows[userIndex], userIndex + 1);
  }

  return { items, currentUserEntry, totalCount };
}

export async function listAchievements(userId: string): Promise<SkillsHuntAchievement[]> {
  const result = await queryDb<SkillsHuntAchievementRow>(
    `
      SELECT id, user_id, code, title, description, round_id, metadata, archived_at, awarded_at
      FROM skills_hunt_achievements
      WHERE user_id = $1
      ORDER BY awarded_at DESC
    `,
    [userId],
  );

  return result.rows.map(mapAchievement);
}

export async function listNotifications(userId: string, unreadOnly: boolean): Promise<SkillsHuntNotification[]> {
  const unreadClause = unreadOnly ? 'AND is_read = false' : '';
  const result = await queryDb<SkillsHuntNotificationRow>(
    `
      SELECT id, user_id, kind, title, body, metadata, is_read, read_at, created_at
      FROM skills_hunt_notifications
      WHERE user_id = $1
        ${unreadClause}
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [userId],
  );

  return result.rows.map(mapNotification);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<SkillsHuntNotification | null> {
  const result = await queryDb<SkillsHuntNotificationRow>(
    `
      UPDATE skills_hunt_notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2
      RETURNING id, user_id, kind, title, body, metadata, is_read, read_at, created_at
    `,
    [notificationId, userId],
  );

  return result.rows[0] ? mapNotification(result.rows[0]) : null;
}

export async function getFeatureRewardCard(): Promise<SkillsHuntFeatureRewardCard | null> {
  const result = await queryDb<SkillsHuntFeatureRewardCardRow>(
    `
      SELECT title, description, cta_label, cta_url, is_active, updated_by_user_id, updated_at
      FROM skills_hunt_feature_reward_card
      WHERE singleton_key = true
      LIMIT 1
    `,
  );

  return result.rows[0] ? mapFeatureRewardCard(result.rows[0]) : null;
}

export async function updateFeatureRewardCard(actorId: string, input: SkillsHuntFeatureRewardCardInput): Promise<SkillsHuntFeatureRewardCard> {
  return withDbTransaction(async (client) => {
    const result = await client.query<SkillsHuntFeatureRewardCardRow>(
      `
        INSERT INTO skills_hunt_feature_reward_card
          (singleton_key, title, description, cta_label, cta_url, is_active, updated_by_user_id, updated_at)
        VALUES
          (true, $1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (singleton_key)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          cta_label = EXCLUDED.cta_label,
          cta_url = EXCLUDED.cta_url,
          is_active = EXCLUDED.is_active,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
        RETURNING title, description, cta_label, cta_url, is_active, updated_by_user_id, updated_at
      `,
      [
        normalizeText(input.title),
        normalizeText(input.description),
        normalizeText(input.ctaLabel),
        normalizeText(input.ctaUrl),
        input.isActive,
        actorId,
      ],
    );

    return mapFeatureRewardCard(result.rows[0]);
  });
}

export async function generateDirectoryProfileFromAcceptedSubmission(
  actorId: string,
  submissionId: string,
  invitedByUsername: string,
): Promise<SkillsHuntGeneratedDirectoryProfile> {
  return withDbTransaction(async (client) => {
    const alreadyGenerated = await client.query<{ id: string }>(
      'SELECT id FROM skills_hunt_directory_profiles WHERE submission_id = $1::uuid LIMIT 1',
      [submissionId],
    );

    if (alreadyGenerated.rows.length > 0) {
      throw new Error('skills_hunt_profile_already_generated');
    }

    await maybeAutoGenerateDirectoryProfile(client, actorId, submissionId, normalizeText(invitedByUsername));

    const projectionResult = await client.query<{
      submission_id: string;
      directory_profile_id: string;
      invited_by_username: string;
      created_at: Date;
      unclaimed_handle: string | null;
    }>(
      `
        SELECT
          shdp.submission_id,
          shdp.directory_profile_id,
          shdp.invited_by_username,
          shdp.created_at,
          dp.unclaimed_handle
        FROM skills_hunt_directory_profiles shdp
        LEFT JOIN directory_profiles dp ON dp.id::text = shdp.directory_profile_id
        WHERE shdp.submission_id = $1::uuid
        LIMIT 1
      `,
      [submissionId],
    );

    const projection = projectionResult.rows[0];
    if (!projection) {
      throw new Error('skills_hunt_submission_not_found');
    }

    return {
      submissionId: projection.submission_id,
      generatedProfileId: projection.directory_profile_id,
      profileStatus: 'unclaimed',
      invitedByUsername: projection.invited_by_username,
      unclaimedHandle: projection.unclaimed_handle ?? null,
      source: 'community-generated',
      createdAtIso: toIso(projection.created_at),
    };
  });
}

export async function getSkillsHuntDashboard(): Promise<{
  roundsTotal: number;
  submissionsTotal: number;
  acceptedTotal: number;
  generatedProfilesTotal: number;
  generatedAtIso: string;
}> {
  const [rounds, submissions, accepted, generated] = await Promise.all([
    queryDb<CountRow>('SELECT COUNT(*)::text AS total FROM skills_hunt_rounds'),
    queryDb<CountRow>('SELECT COUNT(*)::text AS total FROM skills_hunt_submissions'),
    queryDb<CountRow>("SELECT COUNT(*)::text AS total FROM skills_hunt_submissions WHERE status = 'accepted'"),
    queryDb<CountRow>('SELECT COUNT(*)::text AS total FROM skills_hunt_directory_profiles'),
  ]);

  return {
    roundsTotal: Number.parseInt(rounds.rows[0]?.total ?? '0', 10),
    submissionsTotal: Number.parseInt(submissions.rows[0]?.total ?? '0', 10),
    acceptedTotal: Number.parseInt(accepted.rows[0]?.total ?? '0', 10),
    generatedProfilesTotal: Number.parseInt(generated.rows[0]?.total ?? '0', 10),
    generatedAtIso: new Date().toISOString(),
  };
}

export async function insertSkillsHuntAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await queryDb(
    `
      INSERT INTO skills_hunt_audit_log
        (actor_id, command, policy_status, reason, target_type, target_id, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      input.actorId,
      input.command,
      input.policyStatus,
      input.reason,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function listSkillsHuntAuditEvents(limit = 100): Promise<SkillsHuntAuditRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await queryDb<SkillsHuntAuditRow>(
    `
      SELECT id, actor_id, command, policy_status, reason, target_type, target_id, metadata, created_at
      FROM skills_hunt_audit_log
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows;
}
