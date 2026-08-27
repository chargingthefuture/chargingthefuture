import { createHash, randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  SKILLS_HUNT_DEFAULT_PAGE,
  SKILLS_HUNT_DEFAULT_PAGE_SIZE,
  SKILLS_HUNT_FULL_NAME_PATTERN,
  SKILLS_HUNT_MAX_BIO_LENGTH,
  SKILLS_HUNT_MAX_FULL_NAME_LENGTH,
  SKILLS_HUNT_MAX_PROPOSED_SKILLS_PER_SUBMISSION,
  SKILLS_HUNT_MAX_SKILLS_PER_SUBMISSION,
  SKILLS_HUNT_MAX_SKILL_LABEL_LENGTH,
  SKILLS_HUNT_MAX_LOCATION_LENGTH,
  SKILLS_HUNT_MAX_TAXONOMY_SKILL_LABEL_LENGTH,
  SKILLS_HUNT_MIN_FULL_NAME_LENGTH,
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
import { reportError } from 'lib/observability/report';
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
import { generateAutoMissionsForNewRound } from './auto-missions';

type CountRow = { total: string };

type SkillsHuntRoundRow = {
  id: string;
  name: string;
  description: string | null;
  status: SkillsHuntRoundStatus;
  starts_at: Date;
  ends_at: Date;
  scoring_config: Record<string, unknown>;
  reward_credits_per_accept?: number | null;
  reward_per_user_round_cap?: number | null;
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
  full_name: string;
  bio: string;
  quora_profile_url: string;
  skills: unknown;
  proposed_skills?: unknown;
  claimed_professions: unknown;
  status: 'pending' | 'accepted' | 'rejected' | 'flagged';
  points_awarded: number;
  participation_points?: number | null;
  credit_granted?: boolean | null;
  credit_amount?: number | null;
  credit_granted_at?: Date | null;
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

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? toIso(value) : null;
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

// Parse a COUNT(*)::text (or similar) column into a number, treating a missing
// row/column as 0.
function parseCount(value: string | null | undefined): number {
  return Number.parseInt(value ?? '0', 10);
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

// Per-round duplicate key. Identity is intentionally the normalized Quora profile
// URL plus the claimed skill set (taxonomy + proposed) — NOT fullName/bio. The URL
// is the person's identity, so this blocks re-nominating the same profile with the
// same skills in a round. fullName/bio are deliberately excluded: including them
// would let a scout re-submit the same profile with a tweaked name to bypass the
// per-round duplicate guard. Name/bio corrections go through the review 'edit'
// action, not a fresh submission.
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
    rewardCreditsPerAccept: Number(row.reward_credits_per_accept ?? 0),
    rewardPerUserRoundCap:
      row.reward_per_user_round_cap === null || row.reward_per_user_round_cap === undefined
        ? null
        : Number(row.reward_per_user_round_cap),
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
    fullName: row.full_name,
    bio: row.bio,
    quoraProfileUrl: row.quora_profile_url,
    skills: asStringArray(row.skills),
    proposedSkills: asStringArray(row.proposed_skills),
    claimedProfessions: asStringArray(row.claimed_professions),
    status: row.status,
    pointsAwarded: row.points_awarded,
    participationPoints: row.participation_points ?? 0,
    creditGranted: row.credit_granted ?? false,
    creditAmount: Number(row.credit_amount ?? 0),
    creditGrantedAtIso: toIsoOrNull(row.credit_granted_at),
    urlValidationResult: row.url_validation_result ?? null,
    urlValidationCheckedAtIso: toIsoOrNull(row.url_validation_checked_at),
    scoreBreakdown: normalizeJsonObject(row.score_breakdown),
    reviewAction: row.review_action,
    reviewNotes: row.review_notes,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAtIso: toIsoOrNull(row.reviewed_at),
    editHistory: mapEditHistory(row.edit_history),
    editedAtIso: toIsoOrNull(row.edited_at),
    deletedAtIso: toIsoOrNull(row.deleted_at),
    directoryProfileGeneratedAtIso: toIsoOrNull(row.directory_profile_generated_at),
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

// Reward config is whole, non-negative ServiceCredits. Coerce defensively so a
// stray float/NaN/negative from the client never reaches the ledger: floor to a
// non-negative integer, and treat absent/blank as the safe default (0 / no cap).
function normalizeRewardPerAccept(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeRewardCap(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function isValidRewardField(value: number | null | undefined): boolean {
  // Accept absent (default), or a finite non-negative number. Reject NaN/negative.
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function hasValidRewardConfig(input: SkillsHuntRoundInput): boolean {
  return isValidRewardField(input.rewardCreditsPerAccept) && isValidRewardField(input.rewardPerUserRoundCap);
}

export function validateRoundInput(input: SkillsHuntRoundInput): boolean {
  const name = normalizeText(input.name ?? '');
  const description = normalizeNullableText(input.description);
  const validStatus = ['draft', 'active', 'closed', 'archived'].includes(input.status);

  return name.length > 0
    && name.length <= SKILLS_HUNT_MAX_ROUND_NAME_LENGTH
    && (!description || description.length <= SKILLS_HUNT_MAX_ROUND_DESCRIPTION_LENGTH)
    && validStatus
    && hasValidRewardConfig(input)
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

// Normalized view of a submission's text/collection fields, computed once and
// shared by the per-field validators below.
type NormalizedSubmissionFields = {
  fullName: string;
  bio: string;
  skills: string[];
  proposedSkills: string[];
  claimedProfessions: string[];
  country: string;
  state: string | null;
  city: string | null;
};

function normalizeSubmissionFields(input: SkillsHuntSubmissionInput): NormalizedSubmissionFields {
  return {
    fullName: normalizeText(input.fullName ?? ''),
    bio: normalizeText(input.bio ?? ''),
    skills: normalizeArray(input.skills),
    proposedSkills: normalizeArray(input.proposedSkills ?? []),
    claimedProfessions: normalizeArray(input.claimedProfessions),
    // Location: country is REQUIRED (a nominee's country matters, especially for non-US members and
    // the GDP country breakdown); state/city are optional.
    country: normalizeText(input.country ?? ''),
    state: normalizeNullableText(input.state),
    city: normalizeNullableText(input.city),
  };
}

function hasValidSubmissionRoundId(input: SkillsHuntSubmissionInput): boolean {
  return typeof input.roundId === 'string' && input.roundId.length > 0;
}

// Each location field is a plain name capped at the location limit; state/city are optional.
function hasValidSubmissionLocation(fields: NormalizedSubmissionFields): boolean {
  return fields.country.length > 0
    && fields.country.length <= SKILLS_HUNT_MAX_LOCATION_LENGTH
    && (!fields.state || fields.state.length <= SKILLS_HUNT_MAX_LOCATION_LENGTH)
    && (!fields.city || fields.city.length <= SKILLS_HUNT_MAX_LOCATION_LENGTH);
}

// Spec §2.1: full name 2–100 chars, letters/digits/spaces only.
function hasValidSubmissionFullName(fullName: string): boolean {
  return isLengthInRange(fullName, SKILLS_HUNT_MIN_FULL_NAME_LENGTH, SKILLS_HUNT_MAX_FULL_NAME_LENGTH)
    && SKILLS_HUNT_FULL_NAME_PATTERN.test(fullName);
}

// Spec §2.1: bio is optional (max 280). Length 0 accepted; >280 rejected.
function hasValidSubmissionBio(bio: string): boolean {
  return bio.length === 0 || bio.length <= SKILLS_HUNT_MAX_BIO_LENGTH;
}

function hasValidSubmissionUrl(input: SkillsHuntSubmissionInput): boolean {
  const quoraProfileUrl = typeof input.quoraProfileUrl === 'string' ? input.quoraProfileUrl.trim() : '';
  return isLengthInRange(quoraProfileUrl, 1, SKILLS_HUNT_MAX_URL_LENGTH);
}

// Spec §2.1: ≥1 skill, sum capped at 10. Free-text proposed skills keep the short 40-char
// cap; taxonomy-picked skills carry the canonical taxonomy name and may be longer (up to the
// taxonomy's 120-char max), so a legitimate long skill name no longer fails the submission.
function hasValidSubmissionSkills(skills: string[], proposedSkills: string[]): boolean {
  const totalSkills = skills.length + proposedSkills.length;
  const pickedWithinLabelLimit = skills.every(
    (label) => label.length <= SKILLS_HUNT_MAX_TAXONOMY_SKILL_LABEL_LENGTH,
  );
  const proposedWithinLabelLimit = proposedSkills.every(
    (label) => label.length <= SKILLS_HUNT_MAX_SKILL_LABEL_LENGTH,
  );
  return totalSkills > 0
    && totalSkills <= SKILLS_HUNT_MAX_SKILLS_PER_SUBMISSION
    && proposedSkills.length <= SKILLS_HUNT_MAX_PROPOSED_SKILLS_PER_SUBMISSION
    && pickedWithinLabelLimit
    && proposedWithinLabelLimit;
}

function hasUnsafeSubmissionText(fields: NormalizedSubmissionFields): boolean {
  return hasUnsafeCollectionText([
    fields.fullName, fields.bio, ...fields.skills, ...fields.proposedSkills, ...fields.claimedProfessions,
  ]);
}

export function validateSubmissionInput(input: SkillsHuntSubmissionInput): boolean {
  const fields = normalizeSubmissionFields(input);

  const checks = [
    hasValidSubmissionRoundId(input),
    hasValidSubmissionFullName(fields.fullName),
    hasValidSubmissionBio(fields.bio),
    hasValidSubmissionUrl(input),
    hasValidSubmissionSkills(fields.skills, fields.proposedSkills),
    fields.claimedProfessions.length <= 20,
    hasValidSubmissionLocation(fields),
    !hasUnsafeSubmissionText(fields),
  ];

  return checks.every((ok) => ok);
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
        reward_credits_per_accept,
        reward_per_user_round_cap,
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
// Resolve the reputation tier and the rolling 7-day submission limit from the
// user's reviewed sample and accept/reject rates:
//   - 'restricted' (sample ≥ preApprovalMinSampleSize AND rejection rate > threshold)
//   - 'trusted'    (sample ≥ trustedMinSampleSize AND acceptance rate ≥ threshold) → trusted limit
//   - 'standard'   (sample ≥ trustedMinSampleSize but not yet trusted)
//   - 'new'        (sample below the trusted sample size)
// Only the 'trusted' tier raises the rolling limit; every other tier keeps the
// new-user limit.
function resolveReputationTier(
  reviewedCount: number,
  acceptanceRate: number | null,
  rejectionRate: number | null,
): { tier: SkillsHuntReputationProfile['tier']; rolling7dLimit: number } {
  if (
    reviewedCount >= SKILLS_HUNT_REPUTATION.preApprovalMinSampleSize &&
    rejectionRate !== null &&
    rejectionRate > SKILLS_HUNT_REPUTATION.preApprovalRejectionRateThreshold
  ) {
    return { tier: 'restricted', rolling7dLimit: SKILLS_HUNT_REPUTATION.newUserSubmissionLimit7d };
  }
  if (
    reviewedCount >= SKILLS_HUNT_REPUTATION.trustedMinSampleSize &&
    acceptanceRate !== null &&
    acceptanceRate >= SKILLS_HUNT_REPUTATION.trustedAcceptanceRateThreshold
  ) {
    return { tier: 'trusted', rolling7dLimit: SKILLS_HUNT_REPUTATION.trustedUserSubmissionLimit7d };
  }
  if (reviewedCount >= SKILLS_HUNT_REPUTATION.trustedMinSampleSize) {
    return { tier: 'standard', rolling7dLimit: SKILLS_HUNT_REPUTATION.newUserSubmissionLimit7d };
  }
  return { tier: 'new', rolling7dLimit: SKILLS_HUNT_REPUTATION.newUserSubmissionLimit7d };
}

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
  const rolling7dCount = parseCount(usageResult.rows[0]?.total);

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

  const stats = reviewedResult.rows[0];
  const reviewedCount = parseCount(stats?.total);
  const acceptedCount = parseCount(stats?.accepted);
  const rejectedCount = parseCount(stats?.rejected);
  const pendingCount = parseCount(stats?.pending);
  const acceptanceRate = reviewedCount > 0 ? acceptedCount / reviewedCount : null;
  const rejectionRate = reviewedCount > 0 ? rejectedCount / reviewedCount : null;

  const resolved = resolveReputationTier(reviewedCount, acceptanceRate, rejectionRate);

  return {
    userId,
    tier: resolved.tier,
    acceptedCount,
    rejectedCount,
    pendingCount,
    rolling7dCount,
    rolling7dLimit: resolved.rolling7dLimit,
    acceptanceRate,
    preApprovalRequired: resolved.tier === 'restricted',
  };
}

// The cap is a rolling 7-day window, so a slot frees when an in-window
// submission ages past 7 days. To drop back under the cap we need
// (count - limit + 1) of the oldest in-window submissions to age out; the
// last of those to expire (created_at + 7 days) is when the scout can submit
// again. Returns that time so the API can tell the scout when (null if the
// oldest in-window row can't be resolved).
async function computeRateLimitResetIso(
  client: PoolClient,
  userId: string,
  profile: SkillsHuntReputationProfile,
): Promise<string | null> {
  const offset = Math.max(0, profile.rolling7dCount - profile.rolling7dLimit);
  const oldestResult = await client.query<{ created_at: Date }>(
    `SELECT created_at FROM skills_hunt_submissions
      WHERE submitter_user_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      OFFSET $2 LIMIT 1`,
    [userId, offset],
  );
  const oldest = oldestResult.rows[0]?.created_at;
  return oldest ? new Date(oldest.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
}

// Belt-and-braces: keep the legacy rejection-rate guard on the most recent
// sample. Wave 2 reputation supersedes the lifetime >20% gate, but the
// sample-based check still catches rapid degradation that lifetime stats
// haven't caught up to yet.
async function enforceRejectionGuard(
  client: PoolClient,
  userId: string,
  profile: SkillsHuntReputationProfile,
): Promise<void> {
  const reviewedCount = profile.acceptedCount + profile.rejectedCount;
  if (reviewedCount < SKILLS_HUNT_REJECTION_GUARD_SAMPLE_SIZE) {
    return;
  }

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
  const sampledTotal = parseCount(recent.rows[0]?.total);
  const sampledRejected = parseCount(recent.rows[0]?.rejected);
  if (sampledTotal < SKILLS_HUNT_REJECTION_GUARD_SAMPLE_SIZE) {
    return;
  }

  const rate = sampledRejected / sampledTotal;
  if (rate >= SKILLS_HUNT_REJECTION_GUARD_THRESHOLD) {
    throw new Error('skills_hunt_rejection_guard_violation');
  }
}

async function ensureSubmissionRateLimits(client: PoolClient, userId: string): Promise<SkillsHuntReputationProfile> {
  const profile = await computeReputationProfile(client, userId);

  if (profile.preApprovalRequired) {
    throw new Error('skills_hunt_pre_approval_required');
  }

  if (profile.rolling7dCount >= profile.rolling7dLimit) {
    const resetAtIso = await computeRateLimitResetIso(client, userId, profile);
    throw new Error(resetAtIso ? `skills_hunt_submission_limit_exceeded:${resetAtIso}` : 'skills_hunt_submission_limit_exceeded');
  }

  await enforceRejectionGuard(client, userId, profile);

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

// first-finder — this submission's score includes the firstMatchBonus.
async function maybeAwardFirstFinder(
  client: PoolClient,
  userId: string,
  roundId: string,
  scoreBreakdown: Record<string, unknown>,
): Promise<void> {
  const firstMatchBonus = scoreBreakdown.firstMatchBonus;
  if (typeof firstMatchBonus === 'number' && firstMatchBonus > 0) {
    await ensureAchievement(
      client, userId,
      NAMED_BADGES.firstFinder.code, NAMED_BADGES.firstFinder.title, NAMED_BADGES.firstFinder.description,
      roundId,
    );
  }
}

// rare-talent-scout — 3+ accepted submissions tagged with rare skills.
// "tagged with rare skills" = score_breakdown.rareSkillBonus > 0.
async function maybeAwardRareTalentScout(
  client: PoolClient,
  userId: string,
  roundId: string,
): Promise<void> {
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
  const rareCount = parseCount(rareCountResult.rows[0]?.total);
  if (rareCount >= 3) {
    await ensureAchievement(
      client, userId,
      NAMED_BADGES.rareTalentScout.code, NAMED_BADGES.rareTalentScout.title, NAMED_BADGES.rareTalentScout.description,
      roundId,
    );
  }
}

// diversity-champion — accepted submissions spanning 3+ distinct claimed
// professions. claimed_professions is a JSONB array, so we unnest into rows.
async function maybeAwardDiversityChampion(
  client: PoolClient,
  userId: string,
  roundId: string,
): Promise<void> {
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
  const distinctProfessionCount = parseCount(diversityResult.rows[0]?.total);
  if (distinctProfessionCount >= 3) {
    await ensureAchievement(
      client, userId,
      NAMED_BADGES.diversityChampion.code, NAMED_BADGES.diversityChampion.title, NAMED_BADGES.diversityChampion.description,
      roundId,
    );
  }
}

// quality-contributor — 100% acceptance rate with 5+ accepted submissions.
// 100% rate = accepted >= 5 AND rejected = 0. Edits still count as accepted.
async function maybeAwardQualityContributor(
  client: PoolClient,
  userId: string,
  roundId: string,
): Promise<void> {
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
  const acceptedCount = parseCount(qualityResult.rows[0]?.accepted);
  const rejectedCount = parseCount(qualityResult.rows[0]?.rejected);
  if (acceptedCount >= 5 && rejectedCount === 0) {
    await ensureAchievement(
      client, userId,
      NAMED_BADGES.qualityContributor.code, NAMED_BADGES.qualityContributor.title, NAMED_BADGES.qualityContributor.description,
      roundId,
    );
  }
}

async function awardNamedBadges(
  client: PoolClient,
  userId: string,
  roundId: string,
  scoreBreakdown: Record<string, unknown>,
): Promise<void> {
  await maybeAwardFirstFinder(client, userId, roundId, scoreBreakdown);
  await maybeAwardRareTalentScout(client, userId, roundId);
  await maybeAwardDiversityChampion(client, userId, roundId);
  await maybeAwardQualityContributor(client, userId, roundId);
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
    full_name: string;
    bio: string;
    quora_profile_url: string;
    claimed_professions: unknown;
    skills: unknown;
    proposed_skills: unknown;
    country: string | null;
    state: string | null;
    city: string | null;
  }>(
    `
      SELECT id, full_name, bio, quora_profile_url, claimed_professions, skills, proposed_skills, country, state, city
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

  // If this person's Quora URL was taken down from the directory at their request (an active row in
  // directory_suppressed_quora_urls), do NOT generate a directory profile for them. The SkillsHunt
  // accept itself still stands; only the directory listing is suppressed until an admin lifts it. The
  // URL was validated at submission time, so normalizing it here does not throw for a stored value.
  let normalizedQuoraForSuppression: string | null = null;
  try {
    normalizedQuoraForSuppression = normalizeQuoraProfileUrl(submission.quora_profile_url);
  } catch {
    normalizedQuoraForSuppression = null;
  }
  if (normalizedQuoraForSuppression) {
    const suppressed = await client.query<{ id: string }>(
      'SELECT id FROM directory_suppressed_quora_urls WHERE normalized_url = $1 AND is_overridden = false LIMIT 1',
      [normalizedQuoraForSuppression],
    );
    if (suppressed.rows.length > 0) {
      await client.query(
        `
          INSERT INTO directory_profile_change_events
            (actor_id, command, policy_status, reason, target_type, target_id, metadata)
          VALUES ($1, 'directory.profile.generate', 'deny', 'quora_url_suppressed', 'submission', $2::uuid, $3::jsonb)
        `,
        [actorId, submissionId, JSON.stringify({ normalizedUrl: normalizedQuoraForSuppression })],
      );
      return;
    }
  }

  const professions = asStringArray(submission.claimed_professions);
  // No generic "SkillsHunt contributor" headline — a nominated profile is shown as a
  // community-generated profile (with who nominated it), driven by the columns below, not a
  // placeholder headline. Only a real claimed profession becomes the headline.
  const headline = professions[0] ?? null;
  // Reserved unclaimed handle so the generated profile has a stable @handle until a verified
  // owner claims it (per the SkillsHunt inventory: community-<hex> namespace).
  const unclaimedHandle = `community-${randomUUID().replace(/-/g, '').slice(0, 6)}`;

  const insertedDirectoryProfile = await client.query<{ id: string }>(
    `
      INSERT INTO directory_profiles
        (claimed_by_user_id, first_name, headline, bio, profile_url, sector_id, job_title_id, is_active, source, invited_by_username, unclaimed_handle, country, state, city)
      VALUES
        (NULL, $1, $2, $3, $4, NULL, NULL, true, 'community-generated', $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [submission.full_name, headline, submission.bio, submission.quora_profile_url, invitedByUsername, unclaimedHandle, submission.country, submission.state, submission.city],
  );

  const directoryProfileId = insertedDirectoryProfile.rows[0].id;

  // Carry the nominated skills into the Directory's normalized skill junction so the
  // generated profile actually shows its skills (the Directory renders skills only from
  // directory_profile_skills joined to skills_taxonomy_skills). Both taxonomy-picked skills
  // and free-text "proposed" skills are matched to a canonical taxonomy skill by name or
  // alias (case-insensitive): any label already in the taxonomy is linked (so a real skill
  // typed as free text still shows), and a proposed label with no match is left unlinked for
  // the promotion pipeline (which only proposes labels not already in the taxonomy, so the
  // two never conflict).
  const submittedSkills = Array.from(
    new Set([...asStringArray(submission.skills), ...asStringArray(submission.proposed_skills)]),
  );
  if (submittedSkills.length > 0) {
    await client.query(
      `
        INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
        SELECT $1::uuid, sk.id, lbl.ord
        FROM unnest($2::text[]) WITH ORDINALITY AS lbl(label, ord)
        JOIN LATERAL (
          SELECT s.id
          FROM skills_taxonomy_skills s
          WHERE s.is_active = true
            AND (
              lower(s.name) = lower(btrim(lbl.label))
              OR EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(s.aliases) a
                WHERE lower(a) = lower(btrim(lbl.label))
              )
            )
          ORDER BY s.display_order ASC
          LIMIT 1
        ) sk ON true
        ON CONFLICT (profile_id, skill_id) DO NOTHING
      `,
      [directoryProfileId, submittedSkills],
    );
  }

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
        reward_credits_per_accept,
        reward_per_user_round_cap,
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
  const round = await withDbTransaction(async (client) => {
    const row = await client.query<SkillsHuntRoundRow>(
      `
        INSERT INTO skills_hunt_rounds
          (name, description, status, starts_at, ends_at, scoring_config, reward_credits_per_accept, reward_per_user_round_cap, created_by_user_id, updated_by_user_id)
        VALUES
          ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::jsonb, $7, $8, $9, $9)
        RETURNING
          id,
          name,
          description,
          status,
          starts_at,
          ends_at,
          scoring_config,
          reward_credits_per_accept,
          reward_per_user_round_cap,
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
        normalizeRewardPerAccept(input.rewardCreditsPerAccept),
        normalizeRewardCap(input.rewardPerUserRoundCap),
        actorId,
      ],
    );

    // Snapshot Workforce rare-skill state at round-create. Keeps the
    // Rare Skill bonus stable for the round's lifetime per spec.
    await snapshotRareSkillsForRound(client, row.rows[0].id);

    return mapRound(row.rows[0]);
  });

  // Open the round's Workforce gap missions in a follow-up transaction: a failed gap read or
  // insert is reported but never undoes the round itself.
  try {
    await withDbTransaction((client) => generateAutoMissionsForNewRound(client, round.id));
  } catch (autoMissionError) {
    reportError(autoMissionError, { area: 'skills-hunt', op: 'auto_missions_on_round_create', extra: { roundId: round.id } });
  }

  return round;
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
          reward_credits_per_accept = $8,
          reward_per_user_round_cap = $9,
          updated_by_user_id = $10,
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
          reward_credits_per_accept,
          reward_per_user_round_cap,
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
        normalizeRewardPerAccept(input.rewardCreditsPerAccept),
        normalizeRewardCap(input.rewardPerUserRoundCap),
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

// Read a single round (including its reward config) without a caller-supplied
// client. Used by the review route to resolve the per-accept reward and cap.
export async function getRound(roundId: string): Promise<SkillsHuntRound | null> {
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
        reward_credits_per_accept,
        reward_per_user_round_cap,
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

  const row = result.rows[0];
  return row ? mapRound(row) : null;
}

// Read a single submission by id, returning the authoritative database row.
// Used to refresh the response body after a best-effort reward mutation so the
// API never reports in-memory state that diverges from what was committed.
export async function getSubmissionById(submissionId: string): Promise<SkillsHuntSubmission | null> {
  const result = await queryDb<SkillsHuntSubmissionRow>(
    `
      SELECT
        id,
        round_id,
        submitter_user_id,
        submitter_username,
        full_name,
        bio,
        quora_profile_url,
        skills,
        proposed_skills,
        claimed_professions,
        status,
        points_awarded,
        participation_points,
        credit_granted,
        credit_amount,
        credit_granted_at,
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
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [submissionId],
  );

  const row = result.rows[0];
  return row ? mapSubmission(row) : null;
}

// Atomically claim the accept reward for a submission under the per-scout,
// per-round cap. A transaction-scoped advisory lock keyed on (round, scout)
// serializes concurrent accepts for the same scout so two of them cannot both
// pass the cap and overpay. On success the submission is marked credited inside
// the lock (claim-then-mint); the caller mints next and reverts the claim if the
// mint is rejected. Returns false when already granted or the cap would be crossed.
export async function claimSkillsHuntRewardUnderCap(input: {
  submissionId: string;
  roundId: string;
  submitterUserId: string;
  amount: number;
  cap: number | null;
}): Promise<boolean> {
  return withDbTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sh-reward:${input.roundId}:${input.submitterUserId}`]);

    const current = await client.query<{ credit_granted: boolean | null; status: string }>(
      `SELECT credit_granted, status
       FROM skills_hunt_submissions
       WHERE id = $1::uuid AND round_id = $2::uuid AND submitter_user_id = $3
       FOR UPDATE`,
      [input.submissionId, input.roundId, input.submitterUserId],
    );
    const row = current.rows[0];
    // Re-check inside the lock: the submission must still belong to this
    // round+scout, still be accepted (a concurrent reject/flag could have moved
    // it after the route's in-memory check), and not already credited.
    if (!row || row.status !== 'accepted' || row.credit_granted) {
      return false;
    }

    if (input.cap !== null) {
      const sum = await client.query<{ total: string | null }>(
        `SELECT COALESCE(SUM(credit_amount), 0)::text AS total
         FROM skills_hunt_submissions
         WHERE round_id = $1::uuid AND submitter_user_id = $2 AND credit_granted = TRUE`,
        [input.roundId, input.submitterUserId],
      );
      if (Number(sum.rows[0]?.total ?? 0) + input.amount > input.cap) {
        return false;
      }
    }

    await client.query(
      `UPDATE skills_hunt_submissions
       SET credit_granted = TRUE, credit_amount = $2, credit_granted_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [input.submissionId, Math.max(0, Math.floor(input.amount))],
    );
    return true;
  });
}

// Release a reward claim when the mint that should follow it is rejected, so the
// per-scout cap and the paid flag stay accurate (the mint is transactional, so a
// rejection means no credits moved).
export async function revertSkillsHuntCreditClaim(submissionId: string): Promise<void> {
  await queryDb(
    `UPDATE skills_hunt_submissions
     SET credit_granted = FALSE, credit_amount = 0, credit_granted_at = NULL, updated_at = NOW()
     WHERE id = $1::uuid AND credit_granted = TRUE`,
    [submissionId],
  );
}

// Round-level reward rollup for the admin shell: how many scouts were paid and
// how many credits in total this round has minted.
export async function getRoundRewardSummary(
  roundId: string,
): Promise<{ totalCreditsPaid: number; rewardedSubmissionCount: number }> {
  const result = await queryDb<{ total: string | null; count: string | null }>(
    `
      SELECT
        COALESCE(SUM(credit_amount), 0)::text AS total,
        COUNT(*)::text AS count
      FROM skills_hunt_submissions
      WHERE round_id = $1::uuid
        AND credit_granted = TRUE
    `,
    [roundId],
  );
  return {
    totalCreditsPaid: Number(result.rows[0]?.total ?? 0),
    rewardedSubmissionCount: Number(result.rows[0]?.count ?? 0),
  };
}

export async function createSubmission(
  submitterUserId: string,
  submitterUsername: string | null,
  input: SkillsHuntSubmissionInput,
  // Admins are exempt from the scout rate limits — the rolling weekly submission
  // cap and the reputation-driven pre-approval/restricted gate. The active-round
  // window and the one-active-submission-per-Quora-URL duplicate guard still apply
  // to everyone.
  options: { isAdmin?: boolean } = {},
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
    if (!options.isAdmin) {
      await ensureSubmissionRateLimits(client, submitterUserId);
    }

    const normalizedUrl = normalizedUrlForCheck;

    // One person = one Quora profile URL. Quora does not recycle handles, so a
    // normalized profile URL uniquely identifies a person. Block a second *active*
    // submission for the same URL — across all rounds, not just this one — so the
    // same person can't be nominated (and rewarded) twice. A rejected or deleted
    // submission does NOT block a legitimate re-nomination. The transaction-scoped
    // advisory lock closes the race between two concurrent submissions of the same
    // URL (the earlier url+skills signature key missed this: same URL, different
    // skills, hashed differently, so both slipped through and were accepted).
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`skills_hunt_submission_url:${normalizedUrl}`]);
    const existingActive = await client.query<{ id: string }>(
      `SELECT id
         FROM skills_hunt_submissions
        WHERE quora_profile_url_normalized = $1
          AND status <> 'rejected'
          AND deleted_at IS NULL
        LIMIT 1`,
      [normalizedUrl],
    );
    if (existingActive.rowCount && existingActive.rowCount > 0) {
      throw new Error('skills_hunt_duplicate_submission');
    }

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
            full_name,
            bio,
            quora_profile_url,
            quora_profile_url_normalized,
            skills,
            proposed_skills,
            claimed_professions,
            signature_hash,
            country,
            state,
            city,
            status,
            points_awarded,
            score_breakdown,
            url_validation_result,
            url_validation_checked_at
          )
        VALUES
          ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $13::jsonb, $9::jsonb, $10, $14, $15, $16, 'pending', 0, '{}'::jsonb, $11, $12::timestamptz)
        RETURNING
          id,
          round_id,
          submitter_user_id,
          submitter_username,
          full_name,
          bio,
          quora_profile_url,
          skills,
          proposed_skills,
          claimed_professions,
          status,
          points_awarded,
          participation_points,
          credit_granted,
          credit_amount,
          credit_granted_at,
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
        normalizeText(input.fullName),
        normalizeText(input.bio),
        normalizedUrl,
        normalizedUrl,
        JSON.stringify(skills),
        JSON.stringify(claimedProfessions),
        signatureHash,
        liveness.result,
        liveness.checkedAtIso,
        JSON.stringify(proposedSkills),
        normalizeText(input.country),
        normalizeNullableText(input.state),
        normalizeNullableText(input.city),
      ],
    );

    await insertNotification(
      client,
      submitterUserId,
      'submission-created',
      'Submission received',
      'Your SkillsHunt submission has been queued for moderation review.',
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
      // Preserve the whole message — it may carry a `:<reset ISO>` suffix the
      // route uses to tell the scout when they can submit again.
      throw new Error(message);
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
      full_name,
      bio,
      quora_profile_url,
      skills,
      proposed_skills,
      claimed_professions,
      status,
      points_awarded,
      participation_points,
      credit_granted,
      credit_amount,
      credit_granted_at,
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

// Resolved review decision: the new status plus the point/score/participation
// values derived from the moderator's action. Purely computes the outcome; the
// caller persists it.
type ReviewOutcome = {
  status: SkillsHuntSubmission['status'];
  pointsAwarded: number;
  scoreBreakdown: Record<string, unknown>;
  participationPoints: number;
};

async function resolveReviewOutcome(
  client: PoolClient,
  existing: SkillsHuntSubmissionRow,
  submissionId: string,
  input: SkillsHuntSubmissionReviewInput,
): Promise<ReviewOutcome> {
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

  return { status, pointsAwarded, scoreBreakdown, participationPoints };
}

// Fan out emitLeaderboardTopTen() for anyone who is inside the top-ten cap now
// (after the rebuild) but was not before.
async function emitNewTopTenEntries(
  client: PoolClient,
  roundId: string,
  topTenBefore: Set<string>,
): Promise<void> {
  const topTenAfter = await readCurrentTopTen(client, roundId);
  for (const entry of topTenAfter) {
    if (!topTenBefore.has(entry.userId)) {
      await emitLeaderboardTopTen(client, entry.userId, roundId, entry.rank, entry.score);
    }
  }
}

// Post-accept fan-out: acceptance notification (only on a real transition into
// accepted), named badges, mission-progress recompute + mission-complete
// notifications, and the best-effort Directory profile generation.
async function handleAcceptedReview(
  client: PoolClient,
  actorId: string,
  actorUsername: string | null,
  existing: SkillsHuntSubmissionRow,
  submissionId: string,
  pointsAwarded: number,
  scoreBreakdown: Record<string, unknown>,
): Promise<void> {
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
  // Generating the Directory profile is a best-effort follow-up to the accept: it must
  // never roll back the review decision. Isolate it in a savepoint so any failure (e.g. a
  // legacy not-null column on cloned data) leaves the accept committed; the profile can be
  // regenerated later via generateDirectoryProfileFromAcceptedSubmission.
  try {
    await client.query('SAVEPOINT sh_directory_profile');
    await maybeAutoGenerateDirectoryProfile(client, actorId, submissionId, attributionUsername);
    await client.query('RELEASE SAVEPOINT sh_directory_profile');
  } catch (directoryError) {
    await client.query('ROLLBACK TO SAVEPOINT sh_directory_profile');
    reportError(directoryError, { area: 'skills-hunt', op: 'review_auto_directory_profile', extra: { submissionId } });
  }
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
          full_name,
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

    const outcome = await resolveReviewOutcome(client, existing, submissionId, input);
    const status = outcome.status;
    const pointsAwarded = outcome.pointsAwarded;
    const scoreBreakdown = outcome.scoreBreakdown;
    const participationPoints = outcome.participationPoints;

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
          full_name,
          bio,
          quora_profile_url,
          skills,
          proposed_skills,
          claimed_professions,
          status,
          points_awarded,
          participation_points,
          credit_granted,
          credit_amount,
          credit_granted_at,
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

    await emitNewTopTenEntries(client, existing.round_id, topTenBefore);

    if (status === 'accepted') {
      await handleAcceptedReview(
        client,
        actorId,
        actorUsername,
        existing,
        submissionId,
        pointsAwarded,
        scoreBreakdown,
      );
    }

    if (status === 'rejected') {
      await emitSubmissionRejected(client, existing.submitter_user_id, submissionId);
    }

    // If an already-accepted submission was flipped to reject/flag, roll back the
    // user's mission progress counts. recomputeMissionProgressForUser reads only
    // currently-accepted rows, so this lowers the counts. We deliberately do NOT
    // emit mission-complete notifications on this transition: a downward recompute
    // can only lower progress, never newly complete a mission, so announcing a
    // completion here would always be wrong. (Whether an already-earned completion
    // should be revoked when progress later drops is a separate product decision;
    // today a `completed_at` timestamp is kept sticky once earned.)
    if (existing.status === 'accepted' && status !== 'accepted') {
      await recomputeMissionProgressForUser(client, existing.round_id, existing.submitter_user_id);
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
