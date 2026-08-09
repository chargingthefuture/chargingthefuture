// Contributions repository — voluntary fundraiser drives. Members claim a contribution
// (gift card sent to the owner over Signal, a Quora comment, or a GitHub star); the owner
// confirms it and the platform thanks them with ServiceCredits via the canonical
// service-credits mintGrant() path. This module NEVER writes service_credits tables directly,
// and it never reads or writes any unlock_* table.

import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { mintGrant } from 'lib/service-credits/repository';
import type {
  ContributionKind,
  ContributionStatus,
  ContributionSubmission,
  ContributionSubmissionAdminView,
  ContributionsCycle,
  ContributionsQueueFilters,
  ContributionsRuntimeConfig,
  CreateContributionsCycleInput,
  CreateContributionSubmissionInput,
  FundraiserSnapshot,
  GiftCardMethod,
  ReviewContributionSubmissionInput,
  UpdateContributionsConfigInput,
  UpdateContributionsCycleInput,
} from './types';

export const CONTRIBUTION_KINDS: readonly ContributionKind[] = ['gift_card', 'quora_comment', 'github_star'];
export const GIFT_CARD_METHODS: readonly GiftCardMethod[] = ['amazon', 'apple', 'dennys'];
export const CONTRIBUTION_STATUSES: readonly ContributionStatus[] = ['pending', 'confirmed', 'rejected'];

// Gift-card claims are whole dollars, 1 to 500 (owner decision, 2026-08-09). Real gift cards do not
// come in fractions of a dollar, so nothing is lost by refusing them, and it keeps a claim amount
// something a member can say out loud. The floor is not what keeps credit grants whole — see
// roundCredits below for that — the two rules are independent on purpose.
export const GIFT_CARD_MIN_USD = 1;
export const GIFT_CARD_MAX_USD = 500;

const GRANT_REASON = 'contributions_confirmed';

// --- row types (NUMERIC columns arrive from pg as strings) -------------------------------

type SubmissionRow = {
  id: string;
  user_id: string;
  kind: ContributionKind;
  method: GiftCardMethod | null;
  claimed_amount_usd: string | null;
  signal_contact: string | null;
  quora_post_url: string | null;
  github_profile_url: string | null;
  status: ContributionStatus;
  confirmed_amount_usd: string | null;
  credits_granted: string;
  credit_governance_event_id: string | null;
  cycle_id: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
  updated_at: Date;
};

type CycleRow = {
  id: string;
  starts_at: Date;
  ends_at: Date;
  fiat_goal_usd: string;
  quora_comment_goal: number;
  github_star_goal: number;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type ConfigRow = {
  credits_per_usd: string;
  non_monetary_unit_value_usd: string;
  per_user_cycle_credit_cap: string;
  banner_snooze_months: number;
  banner_enabled: boolean;
  signal_instructions: string;
  updated_by_user_id: string | null;
  updated_at: Date | null;
};

const SUBMISSION_COLUMNS = `
  id, user_id, kind, method, claimed_amount_usd, signal_contact, quora_post_url,
  github_profile_url, status, confirmed_amount_usd, credits_granted,
  credit_governance_event_id, cycle_id, reviewed_by_user_id, reviewed_at, review_note,
  created_at, updated_at`;

function mapSubmission(row: SubmissionRow): ContributionSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    method: row.method,
    claimedAmountUsd: row.claimed_amount_usd === null ? null : Number(row.claimed_amount_usd),
    quoraPostUrl: row.quora_post_url,
    githubProfileUrl: row.github_profile_url,
    status: row.status,
    confirmedAmountUsd: row.confirmed_amount_usd === null ? null : Number(row.confirmed_amount_usd),
    creditsGranted: Number(row.credits_granted),
    creditGovernanceEventId: row.credit_governance_event_id,
    cycleId: row.cycle_id,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    reviewNote: row.review_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSubmissionForAdmin(row: SubmissionRow): ContributionSubmissionAdminView {
  return {
    ...mapSubmission(row),
    signalContact: row.signal_contact,
  };
}

function mapCycle(row: CycleRow): ContributionsCycle {
  return {
    id: row.id,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    fiatGoalUsd: Number(row.fiat_goal_usd),
    quoraCommentGoal: row.quora_comment_goal,
    githubStarGoal: row.github_star_goal,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const DEFAULT_CONFIG: ContributionsRuntimeConfig = {
  creditsPerUsd: 10,
  nonMonetaryUnitValueUsd: 1,
  perUserCycleCreditCap: 300,
  bannerSnoozeMonths: 2,
  bannerEnabled: true,
  signalInstructions: '',
  updatedByUserId: null,
  updatedAt: null,
};

function mapConfig(row: ConfigRow | undefined): ContributionsRuntimeConfig {
  if (!row) {
    return DEFAULT_CONFIG;
  }

  return {
    creditsPerUsd: Number(row.credits_per_usd),
    nonMonetaryUnitValueUsd: Number(row.non_monetary_unit_value_usd),
    perUserCycleCreditCap: Number(row.per_user_cycle_credit_cap),
    bannerSnoozeMonths: row.banner_snooze_months,
    bannerEnabled: row.banner_enabled,
    signalInstructions: row.signal_instructions,
    updatedByUserId: row.updated_by_user_id,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

// --- validation helpers -------------------------------------------------------------------

function isHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// The gift-card CODE is never collected or stored. There is deliberately no code field in the
// schema or the input types; this guard rejects any request payload that tries to smuggle a
// code-like field in anyway.
const CODE_LIKE_KEY = /(code|pin|serial|voucher|card.?number)/i;

export function assertNoGiftCardCodeFields(rawBody: Record<string, unknown>): void {
  for (const key of Object.keys(rawBody)) {
    if (CODE_LIKE_KEY.test(key)) {
      throw new Error('gift_card_code_rejected');
    }
  }
}

function isValidGiftCardAmount(amount: unknown): amount is number {
  return typeof amount === 'number'
    && Number.isInteger(amount)
    && amount >= GIFT_CARD_MIN_USD
    && amount <= GIFT_CARD_MAX_USD;
}

function isValidSignalContact(contact: unknown): boolean {
  if (typeof contact !== 'string') {
    return false;
  }

  const trimmed = contact.trim();
  return trimmed.length > 0 && trimmed.length <= 300;
}

function validateGiftCardFields(input: CreateContributionSubmissionInput): void {
  if (!input.method || !GIFT_CARD_METHODS.includes(input.method)) {
    throw new Error('invalid_method');
  }

  if (!isValidGiftCardAmount(input.claimedAmountUsd)) {
    throw new Error('invalid_amount');
  }

  if (!isValidSignalContact(input.signalContact)) {
    throw new Error('signal_contact_required');
  }
}

function validateNonMonetaryFields(input: CreateContributionSubmissionInput): void {
  if (input.method !== undefined || input.claimedAmountUsd !== undefined || input.signalContact !== undefined) {
    throw new Error('invalid_payload');
  }

  const url = input.kind === 'quora_comment' ? input.quoraPostUrl : input.githubProfileUrl;
  if (url !== undefined && (typeof url !== 'string' || !isHttpUrl(url))) {
    throw new Error('invalid_url');
  }
}

export function validateCreateSubmission(input: CreateContributionSubmissionInput): void {
  if (!CONTRIBUTION_KINDS.includes(input.kind)) {
    throw new Error('invalid_kind');
  }

  if (input.kind === 'gift_card') {
    if (input.quoraPostUrl !== undefined || input.githubProfileUrl !== undefined) {
      throw new Error('invalid_payload');
    }
    validateGiftCardFields(input);
    return;
  }

  validateNonMonetaryFields(input);
}

// --- runtime config ------------------------------------------------------------------------

const CONFIG_SELECT = `
  SELECT credits_per_usd::text, non_monetary_unit_value_usd::text, per_user_cycle_credit_cap::text,
         banner_snooze_months, banner_enabled, signal_instructions, updated_by_user_id, updated_at
  FROM contributions_runtime_config
  WHERE id = TRUE
  LIMIT 1`;

export async function getContributionsConfig(): Promise<ContributionsRuntimeConfig> {
  const result = await queryDb<ConfigRow>(CONFIG_SELECT);
  return mapConfig(result.rows[0]);
}

async function getContributionsConfigWithClient(client: PoolClient): Promise<ContributionsRuntimeConfig> {
  const result = await client.query<ConfigRow>(CONFIG_SELECT);
  return mapConfig(result.rows[0]);
}

function assertPositiveIfPresent(value: number | undefined, code: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error(code);
  }
}

export async function updateContributionsConfig(input: UpdateContributionsConfigInput): Promise<ContributionsRuntimeConfig> {
  assertPositiveIfPresent(input.creditsPerUsd, 'invalid_payload');
  assertPositiveIfPresent(input.nonMonetaryUnitValueUsd, 'invalid_payload');
  assertPositiveIfPresent(input.perUserCycleCreditCap, 'invalid_payload');
  if (input.bannerSnoozeMonths !== undefined && (!Number.isInteger(input.bannerSnoozeMonths) || input.bannerSnoozeMonths <= 0)) {
    throw new Error('invalid_payload');
  }

  const current = await getContributionsConfig();
  const result = await queryDb<ConfigRow>(
    `INSERT INTO contributions_runtime_config (
       id, credits_per_usd, non_monetary_unit_value_usd, per_user_cycle_credit_cap,
       banner_snooze_months, banner_enabled, signal_instructions, updated_by_user_id, updated_at
     )
     VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       credits_per_usd = EXCLUDED.credits_per_usd,
       non_monetary_unit_value_usd = EXCLUDED.non_monetary_unit_value_usd,
       per_user_cycle_credit_cap = EXCLUDED.per_user_cycle_credit_cap,
       banner_snooze_months = EXCLUDED.banner_snooze_months,
       banner_enabled = EXCLUDED.banner_enabled,
       signal_instructions = EXCLUDED.signal_instructions,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = NOW()
     RETURNING credits_per_usd::text, non_monetary_unit_value_usd::text, per_user_cycle_credit_cap::text,
       banner_snooze_months, banner_enabled, signal_instructions, updated_by_user_id, updated_at`,
    [
      input.creditsPerUsd ?? current.creditsPerUsd,
      input.nonMonetaryUnitValueUsd ?? current.nonMonetaryUnitValueUsd,
      input.perUserCycleCreditCap ?? current.perUserCycleCreditCap,
      input.bannerSnoozeMonths ?? current.bannerSnoozeMonths,
      input.bannerEnabled ?? current.bannerEnabled,
      input.signalInstructions ?? current.signalInstructions,
      input.actorUserId,
    ],
  );

  return mapConfig(result.rows[0]);
}

// --- fundraiser cycles -----------------------------------------------------------------------

const CYCLE_COLUMNS = `
  id, starts_at, ends_at, fiat_goal_usd::text, quora_comment_goal, github_star_goal,
  created_by_user_id, created_at, updated_at`;

export async function getCurrentCycle(): Promise<ContributionsCycle | null> {
  const result = await queryDb<CycleRow>(
    `SELECT ${CYCLE_COLUMNS}
     FROM contributions_cycles
     WHERE starts_at <= NOW() AND ends_at > NOW()
     ORDER BY starts_at DESC
     LIMIT 1`,
  );

  const row = result.rows[0];
  return row ? mapCycle(row) : null;
}

export async function listCycles(limit = 50): Promise<ContributionsCycle[]> {
  const result = await queryDb<CycleRow>(
    `SELECT ${CYCLE_COLUMNS}
     FROM contributions_cycles
     ORDER BY starts_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );

  return result.rows.map(mapCycle);
}

function validateCycleWindow(startsAt: string | undefined, endsAt: string | undefined): void {
  for (const candidate of [startsAt, endsAt]) {
    if (candidate !== undefined && Number.isNaN(Date.parse(candidate))) {
      throw new Error('invalid_payload');
    }
  }

  if (startsAt !== undefined && endsAt !== undefined && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error('invalid_cycle_window');
  }
}

function validateCycleGoals(input: { fiatGoalUsd?: number; quoraCommentGoal?: number; githubStarGoal?: number }): void {
  if (input.fiatGoalUsd !== undefined && (!Number.isFinite(input.fiatGoalUsd) || input.fiatGoalUsd < 0)) {
    throw new Error('invalid_payload');
  }

  for (const goal of [input.quoraCommentGoal, input.githubStarGoal]) {
    if (goal !== undefined && (!Number.isInteger(goal) || goal < 0)) {
      throw new Error('invalid_payload');
    }
  }
}

export async function createCycle(input: CreateContributionsCycleInput): Promise<ContributionsCycle> {
  validateCycleWindow(input.startsAt, input.endsAt);
  validateCycleGoals(input);

  const result = await queryDb<CycleRow>(
    `INSERT INTO contributions_cycles (
       starts_at, ends_at, fiat_goal_usd, quora_comment_goal, github_star_goal, created_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${CYCLE_COLUMNS}`,
    [input.startsAt, input.endsAt, input.fiatGoalUsd, input.quoraCommentGoal, input.githubStarGoal, input.actorUserId],
  );

  return mapCycle(result.rows[0]);
}

export async function updateCycle(input: UpdateContributionsCycleInput): Promise<ContributionsCycle | null> {
  validateCycleWindow(input.startsAt, input.endsAt);
  validateCycleGoals(input);

  const result = await queryDb<CycleRow>(
    `UPDATE contributions_cycles
     SET
       starts_at = COALESCE($2, starts_at),
       ends_at = COALESCE($3, ends_at),
       fiat_goal_usd = COALESCE($4, fiat_goal_usd),
       quora_comment_goal = COALESCE($5, quora_comment_goal),
       github_star_goal = COALESCE($6, github_star_goal),
       updated_at = NOW()
     WHERE id = $1
     RETURNING ${CYCLE_COLUMNS}`,
    [
      input.cycleId,
      input.startsAt ?? null,
      input.endsAt ?? null,
      input.fiatGoalUsd ?? null,
      input.quoraCommentGoal ?? null,
      input.githubStarGoal ?? null,
    ],
  );

  const row = result.rows[0];
  return row ? mapCycle(row) : null;
}

// --- member submissions ------------------------------------------------------------------------

// [method, claimed_amount_usd, signal_contact, quora_post_url, github_profile_url] per kind.
function kindSpecificInsertValues(input: CreateContributionSubmissionInput): (string | number | null)[] {
  if (input.kind === 'gift_card') {
    return [input.method ?? null, input.claimedAmountUsd ?? null, input.signalContact?.trim() ?? null, null, null];
  }

  if (input.kind === 'quora_comment') {
    return [null, null, null, input.quoraPostUrl ?? null, null];
  }

  return [null, null, null, null, input.githubProfileUrl ?? null];
}

/**
 * True when this member already holds a confirmed github_star contribution that earned credits
 * (credits_granted > 0), across all cycles. A github_star is a once-per-member-ever thank-you, so
 * this gate stops star/unstar gaming. A rejected star, or a confirmed-but-zero-credit star (e.g.
 * clamped by the per-cycle cap), does NOT lock the member out — honest retries must still work.
 */
export async function hasCreditedGithubStar(userId: string): Promise<boolean> {
  const result = await queryDb<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM contributions_submissions
       WHERE user_id = $1 AND kind = 'github_star' AND status = 'confirmed' AND credits_granted > 0
     ) AS exists`,
    [userId],
  );

  return result.rows[0]?.exists ?? false;
}

async function hasCreditedGithubStarWithClient(client: PoolClient, userId: string, excludeSubmissionId: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM contributions_submissions
       WHERE user_id = $1 AND kind = 'github_star' AND status = 'confirmed'
         AND credits_granted > 0 AND id <> $2
     ) AS exists`,
    [userId, excludeSubmissionId],
  );

  return result.rows[0]?.exists ?? false;
}

export async function createSubmission(input: CreateContributionSubmissionInput): Promise<ContributionSubmission> {
  validateCreateSubmission(input);

  // A github_star is creditable at most once per member, ever. Reject a new star claim outright
  // when the member already has a confirmed, credit-earning star. Gift cards and Quora comments
  // are unaffected (they remain repeatable).
  if (input.kind === 'github_star' && (await hasCreditedGithubStar(input.userId))) {
    throw new Error('github_star_already_credited');
  }

  const cycle = await getCurrentCycle();
  const result = await queryDb<SubmissionRow>(
    `INSERT INTO contributions_submissions (
       user_id, kind, method, claimed_amount_usd, signal_contact, quora_post_url, github_profile_url, cycle_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${SUBMISSION_COLUMNS}`,
    [input.userId, input.kind, ...kindSpecificInsertValues(input), cycle?.id ?? null],
  );

  return mapSubmission(result.rows[0]);
}

export async function listOwnSubmissions(userId: string): Promise<ContributionSubmission[]> {
  const result = await queryDb<SubmissionRow>(
    `SELECT ${SUBMISSION_COLUMNS}
     FROM contributions_submissions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId],
  );

  return result.rows.map(mapSubmission);
}

// --- fundraiser snapshot + banner ---------------------------------------------------------------

type ProgressRow = {
  fiat_confirmed_usd: string;
  quora_comments_confirmed: string;
  github_stars_confirmed: string;
  contributor_count: string;
};

async function isBannerVisibleForUser(userId: string, bannerEnabled: boolean, hasCycle: boolean): Promise<boolean> {
  if (!bannerEnabled || !hasCycle) {
    return false;
  }

  const result = await queryDb<{ snoozed_until: Date | null }>(
    `SELECT snoozed_until FROM contributions_banner_state WHERE user_id = $1 LIMIT 1`,
    [userId],
  );

  const snoozedUntil = result.rows[0]?.snoozed_until ?? null;
  return snoozedUntil === null || snoozedUntil.getTime() <= Date.now();
}

async function recordBannerShown(userId: string): Promise<void> {
  await queryDb(
    `INSERT INTO contributions_banner_state (user_id, last_shown_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_shown_at = NOW(), updated_at = NOW()`,
    [userId],
  );
}

const EMPTY_PROGRESS: ProgressRow = {
  fiat_confirmed_usd: '0',
  quora_comments_confirmed: '0',
  github_stars_confirmed: '0',
  contributor_count: '0',
};

async function fetchCycleProgress(cycleId: string | null): Promise<ProgressRow> {
  if (!cycleId) {
    return EMPTY_PROGRESS;
  }

  // Stars count members, not rows. A star is creditable once per member ever, and the goal on the
  // progress bar is "how many people starred" — but a member can still end up with two confirmed
  // star rows, because the block at submission time only looks at stars that are already confirmed.
  // Send two before either is reviewed and both get confirmed, the second with 0 credits. Counting
  // rows would show that member twice and overstate the community total, so count distinct members.
  // Quora comments are the opposite on purpose: they are repeatable, and every confirmed comment is
  // a real contribution, so those stay a row count.
  const result = await queryDb<ProgressRow>(
    `SELECT
       COALESCE(SUM(confirmed_amount_usd) FILTER (WHERE kind = 'gift_card'), 0)::text AS fiat_confirmed_usd,
       COUNT(*) FILTER (WHERE kind = 'quora_comment')::text AS quora_comments_confirmed,
       COUNT(DISTINCT user_id) FILTER (WHERE kind = 'github_star')::text AS github_stars_confirmed,
       COUNT(DISTINCT user_id)::text AS contributor_count
     FROM contributions_submissions
     WHERE status = 'confirmed' AND cycle_id = $1`,
    [cycleId],
  );

  return result.rows[0] ?? EMPTY_PROGRESS;
}

export async function getFundraiserSnapshot(userId: string): Promise<FundraiserSnapshot> {
  const config = await getContributionsConfig();
  const cycle = await getCurrentCycle();
  const progress = await fetchCycleProgress(cycle ? cycle.id : null);

  const bannerVisible = await isBannerVisibleForUser(userId, config.bannerEnabled, cycle !== null);
  if (bannerVisible) {
    await recordBannerShown(userId);
  }

  const githubStarAlreadyCredited = await hasCreditedGithubStar(userId);

  return {
    cycle,
    fiatConfirmedUsd: Number(progress.fiat_confirmed_usd),
    quoraCommentsConfirmed: Number(progress.quora_comments_confirmed),
    githubStarsConfirmed: Number(progress.github_stars_confirmed),
    contributorCount: Number(progress.contributor_count),
    bannerVisible,
    // bannerEnabled (feature on/off, independent of the per-member snooze) lets the mobile UI tell
    // "snoozed" (show the small emoji reminder) from "turned off" (show nothing at all).
    bannerEnabled: config.bannerEnabled,
    githubStarAlreadyCredited,
  };
}

// Returns nothing on purpose. The snooze length is an internal config knob and the command contract
// says the member is never told how long they have been snoozed for, so there is no snooze horizon
// here for a future caller to pass along by accident.
export async function dismissBanner(userId: string): Promise<void> {
  const config = await getContributionsConfig();
  await queryDb(
    `INSERT INTO contributions_banner_state (user_id, snoozed_until, updated_at)
     VALUES ($1, NOW() + ($2::text || ' months')::interval, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       snoozed_until = NOW() + ($2::text || ' months')::interval,
       updated_at = NOW()`,
    [userId, String(config.bannerSnoozeMonths)],
  );
}

// --- admin review ---------------------------------------------------------------------------------

export async function listSubmissions(filters: ContributionsQueueFilters = {}): Promise<ContributionSubmissionAdminView[]> {
  const values: unknown[] = [];
  let whereClause = '';

  if (filters.status) {
    values.push(filters.status);
    whereClause = `WHERE status = $${values.length}`;
  }

  values.push(Math.min(Math.max(filters.limit ?? 100, 1), 200));

  const result = await queryDb<SubmissionRow>(
    `SELECT ${SUBMISSION_COLUMNS}
     FROM contributions_submissions
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values,
  );

  return result.rows.map(mapSubmissionForAdmin);
}

function resolveConfirmedAmount(
  row: SubmissionRow,
  input: ReviewContributionSubmissionInput,
  config: ContributionsRuntimeConfig,
): number {
  if (row.kind === 'gift_card') {
    // Same whole-dollar rule the member's claim had to clear. The admin types what was actually
    // redeemed, which can differ from the claim, so it is checked here too rather than trusted.
    const amount = input.confirmedAmountUsd;
    if (!isValidGiftCardAmount(amount)) {
      throw new Error('confirmed_amount_required');
    }
    return amount;
  }

  const amount = input.confirmedAmountUsd ?? config.nonMonetaryUnitValueUsd;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_amount');
  }
  return amount;
}

// Credits are a whole-number unit, so a grant is rounded before it is stored or minted.
//
// Nothing upstream guarantees this on its own. Credits are `confirmedAmountUsd × creditsPerUsd`, and
// `creditsPerUsd` is an admin-editable number with no requirement to be a whole number or to divide
// evenly into a dollar — set it to 3 and a whole-dollar claim still lands on a third of a credit. The
// per-cycle cap can be fractional too, so the clamp below can produce a fraction from inputs that
// were both whole. `credits_granted` and the ledger balance are unconstrained NUMERIC columns, so a
// fraction would persist exactly rather than being cleaned up by the database. Rounding here is the
// one place that holds regardless of what the rate is set to.
//
// Rounded, not truncated: at the boundary the member gets the nearer number rather than always the
// lower one. A grant that rounds to 0 still confirms the claim with 0 credits, which is the same
// outcome the cap clamp already produces and is documented on applyConfirmReview.
function roundCredits(credits: number): number {
  return Math.round(credits);
}

async function computeCycleCappedGrant(
  client: PoolClient,
  params: { userId: string; cycleId: string | null; computedCredits: number; cap: number },
): Promise<number> {
  const result = await client.query<{ already_granted: string }>(
    `SELECT COALESCE(SUM(credits_granted), 0)::text AS already_granted
     FROM contributions_submissions
     WHERE user_id = $1 AND status = 'confirmed' AND cycle_id IS NOT DISTINCT FROM $2`,
    [params.userId, params.cycleId],
  );

  const alreadyGranted = Number(result.rows[0]?.already_granted ?? 0);
  const remaining = Math.max(params.cap - alreadyGranted, 0);
  // Rounded after the clamp, never before: rounding first could push a grant back over the cap.
  return roundCredits(Math.max(Math.min(params.computedCredits, remaining), 0));
}

async function applyReviewUpdate(
  client: PoolClient,
  params: {
    submissionId: string;
    status: 'confirmed' | 'rejected';
    actorUserId: string;
    reviewNote: string | null;
    confirmedAmountUsd: number | null;
    creditsGranted: number;
    creditGovernanceEventId: string | null;
    cycleId: string | null;
  },
): Promise<SubmissionRow> {
  const result = await client.query<SubmissionRow>(
    `UPDATE contributions_submissions
     SET
       status = $2,
       reviewed_by_user_id = $3,
       reviewed_at = NOW(),
       review_note = $4,
       confirmed_amount_usd = $5,
       credits_granted = $6,
       credit_governance_event_id = $7,
       cycle_id = $8,
       updated_at = NOW()
     WHERE id = $1
     RETURNING ${SUBMISSION_COLUMNS}`,
    [
      params.submissionId,
      params.status,
      params.actorUserId,
      params.reviewNote,
      params.confirmedAmountUsd,
      params.creditsGranted,
      params.creditGovernanceEventId,
      params.cycleId,
    ],
  );

  return result.rows[0];
}

/**
 * Confirm a locked, still-pending contribution claim. Credits = confirmedAmountUsd x
 * credits_per_usd, clamped by the per-user-per-cycle cap; a positive grant goes through the
 * canonical service-credits mintGrant() (idempotency key `contribution-<submissionId>`). A grant
 * clamped to 0 still confirms the submission with credits_granted = 0.
 */
async function applyConfirmReview(
  client: PoolClient,
  row: SubmissionRow,
  input: ReviewContributionSubmissionInput,
): Promise<SubmissionRow> {
  const config = await getContributionsConfigWithClient(client);
  const confirmedAmountUsd = resolveConfirmedAmount(row, input, config);
  const cycleId = row.cycle_id ?? (await getCurrentCycle())?.id ?? null;

  // Once-per-member-ever github_star: if this member already holds a different confirmed,
  // credit-earning star, confirming this one grants 0 credits (we still mark it confirmed and
  // record the reason). This is defense in depth — the create gate already blocks a duplicate
  // star at submission time — and it never double-grants.
  const githubStarAlreadyCredited =
    row.kind === 'github_star' && (await hasCreditedGithubStarWithClient(client, row.user_id, row.id));

  const computedCredits = githubStarAlreadyCredited ? 0 : confirmedAmountUsd * config.creditsPerUsd;
  const creditsGranted = await computeCycleCappedGrant(client, {
    userId: row.user_id,
    cycleId,
    computedCredits,
    cap: config.perUserCycleCreditCap,
  });

  const reviewNote = githubStarAlreadyCredited
    ? [input.reviewNote, 'No credits: member already received credits for an earlier GitHub star (once-per-member limit).']
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(' ')
    : input.reviewNote ?? null;

  let governanceEventId: string | null = null;
  if (creditsGranted > 0) {
    // Canonical mint path — the only way Contributions touches ServiceCredits. mintGrant is
    // idempotent on its key, so a retried confirm cannot double-grant.
    const grant = await mintGrant({
      actorId: input.actorUserId,
      targetUserId: row.user_id,
      amount: creditsGranted,
      grantReason: GRANT_REASON,
      governanceTicketId: `contribution-${input.submissionId}`,
      idempotencyKey: `contribution-${input.submissionId}`,
    });
    governanceEventId = grant.governanceEventId;
  }

  return applyReviewUpdate(client, {
    submissionId: input.submissionId,
    status: 'confirmed',
    actorUserId: input.actorUserId,
    reviewNote,
    confirmedAmountUsd,
    creditsGranted,
    creditGovernanceEventId: governanceEventId,
    cycleId,
  });
}

/**
 * Confirm or reject a pending contribution claim. Exactly-once: the row is locked and must
 * still be 'pending'. On confirm, credits = confirmedAmountUsd x credits_per_usd, clamped by
 * the per-user-per-cycle cap; a positive grant goes through the canonical service-credits
 * mintGrant() (idempotency key `contribution-<submissionId>`). A grant clamped to 0 still
 * confirms the submission with credits_granted = 0. Rejection grants nothing.
 */
export async function reviewSubmission(input: ReviewContributionSubmissionInput): Promise<ContributionSubmissionAdminView | null> {
  return withDbTransaction(async (client) => {
    const existing = await client.query<SubmissionRow>(
      `SELECT ${SUBMISSION_COLUMNS}
       FROM contributions_submissions
       WHERE id = $1
       FOR UPDATE`,
      [input.submissionId],
    );

    const row = existing.rows[0];
    if (!row) {
      return null;
    }

    if (row.status !== 'pending') {
      throw new Error('already_reviewed');
    }

    if (input.action === 'reject') {
      const updated = await applyReviewUpdate(client, {
        submissionId: input.submissionId,
        status: 'rejected',
        actorUserId: input.actorUserId,
        reviewNote: input.reviewNote ?? null,
        confirmedAmountUsd: null,
        creditsGranted: 0,
        creditGovernanceEventId: null,
        cycleId: row.cycle_id,
      });
      return mapSubmissionForAdmin(updated);
    }

    const updated = await applyConfirmReview(client, row, input);
    return mapSubmissionForAdmin(updated);
  });
}

// --- audit log ----------------------------------------------------------------------------------

/**
 * Append an audit row. Callers must never put signal_contact (or any other personal contact
 * detail) into metadata. Banner dismissal is deliberately not audited.
 */
export async function insertContributionsAudit(input: {
  actorUserId: string | null;
  action: string;
  targetSubmissionId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await queryDb(
    `INSERT INTO contributions_audit_log (actor_user_id, action, target_submission_id, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [input.actorUserId, input.action, input.targetSubmissionId ?? null, JSON.stringify(input.metadata ?? {})],
  );
}
