// Contributions repository — Amazon gift cards, open all year. A member enters the card's amount
// and code; the code is stored encrypted and erased when the owner confirms or rejects the claim. On
// confirm the platform thanks the member with ServiceCredits through the canonical service-credits
// mintGrant() path. This module NEVER writes service_credits tables directly, and it never reads or
// writes any unlock_* table.

import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { mintGrant } from 'lib/shared/credits-interface';
import { decryptGiftCardCode, encryptGiftCardCode, type DecryptedCode } from './code-crypto';
import type {
  ContributionKind,
  ContributionStatus,
  ContributionSubmission,
  ContributionSubmissionAdminView,
  ContributionsQueueFilters,
  ContributionsRuntimeConfig,
  CreateContributionSubmissionInput,
  ReviewContributionSubmissionInput,
  UpdateContributionsConfigInput,
} from './types';

export const CONTRIBUTION_STATUSES: readonly ContributionStatus[] = ['pending', 'confirmed', 'rejected'];

// Gift-card claims are integer dollars, 1 to 500 (owner decision, 2026-08-09). Real gift cards do not
// come in fractions of a dollar, and it keeps a claim amount something a member can say out loud.
export const GIFT_CARD_MIN_USD = 1;
export const GIFT_CARD_MAX_USD = 500;

// Amazon claim codes are letters and digits, usually 14 or 15 with dashes. The bounds are loose so a
// code typed with spaces or a different grouping still goes through; spaces are removed and letters
// upper-cased before it is sealed.
const CODE_PATTERN = /^[A-Z0-9-]{6,40}$/;

const GRANT_REASON = 'contributions_confirmed';

// Deleting Contributions data removes the submissions but keeps the ServiceCredits grant record, so
// the yearly cap reads that record too (#2977); otherwise deleting and resubmitting would reset it.
function grantTicketId(submissionId: string): string {
  return `contribution-${submissionId}:gift_card`;
}

// --- row types (NUMERIC columns arrive from pg as strings) -------------------------------

type SubmissionRow = {
  id: string;
  user_id: string;
  kind: ContributionKind;
  method: string | null;
  claimed_amount_usd: string | null;
  has_code: boolean;
  status: ContributionStatus;
  confirmed_amount_usd: string | null;
  credits_granted: string;
  credit_governance_event_id: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
  updated_at: Date;
};

type ConfigRow = {
  credits_per_usd: string;
  per_user_year_credit_cap: string;
  updated_by_user_id: string | null;
  updated_at: Date | null;
};

// The code column is never selected into a row; only whether one is still stored.
const SUBMISSION_COLUMNS = `
  id, user_id, kind, method, claimed_amount_usd, (gift_card_code_encrypted IS NOT NULL) AS has_code,
  status, confirmed_amount_usd, credits_granted, credit_governance_event_id, reviewed_by_user_id,
  reviewed_at, review_note, created_at, updated_at`;

function mapSubmission(row: SubmissionRow): ContributionSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    method: row.method,
    claimedAmountUsd: row.claimed_amount_usd === null ? null : Number(row.claimed_amount_usd),
    status: row.status,
    confirmedAmountUsd: row.confirmed_amount_usd === null ? null : Number(row.confirmed_amount_usd),
    creditsGranted: Number(row.credits_granted),
    creditGovernanceEventId: row.credit_governance_event_id,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    reviewNote: row.review_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSubmissionForAdmin(row: SubmissionRow): ContributionSubmissionAdminView {
  return { ...mapSubmission(row), hasCode: row.has_code };
}

const DEFAULT_CONFIG: ContributionsRuntimeConfig = {
  creditsPerUsd: 10,
  perUserYearCreditCap: 300,
  updatedByUserId: null,
  updatedAt: null,
};

function mapConfig(row: ConfigRow | undefined): ContributionsRuntimeConfig {
  if (!row) {
    return DEFAULT_CONFIG;
  }
  return {
    creditsPerUsd: Number(row.credits_per_usd),
    perUserYearCreditCap: Number(row.per_user_year_credit_cap),
    updatedByUserId: row.updated_by_user_id,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

// --- validation helpers -------------------------------------------------------------------

export function isValidGiftCardAmount(amount: unknown): amount is number {
  return typeof amount === 'number'
    && Number.isInteger(amount)
    && amount >= GIFT_CARD_MIN_USD
    && amount <= GIFT_CARD_MAX_USD;
}

export function normalizeGiftCardCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const normalized = code.replace(/\s+/g, '').toUpperCase();
  return CODE_PATTERN.test(normalized) ? normalized : null;
}

// --- runtime config ------------------------------------------------------------------------

const CONFIG_SELECT = `
  SELECT credits_per_usd::text, per_user_year_credit_cap::text, updated_by_user_id, updated_at
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

function assertPositiveIfPresent(value: number | undefined): void {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error('invalid_payload');
  }
}

export async function updateContributionsConfig(input: UpdateContributionsConfigInput): Promise<ContributionsRuntimeConfig> {
  assertPositiveIfPresent(input.creditsPerUsd);
  assertPositiveIfPresent(input.perUserYearCreditCap);

  const current = await getContributionsConfig();
  const result = await queryDb<ConfigRow>(
    `INSERT INTO contributions_runtime_config (id, credits_per_usd, per_user_year_credit_cap, updated_by_user_id, updated_at)
     VALUES (TRUE, $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET
       credits_per_usd = EXCLUDED.credits_per_usd,
       per_user_year_credit_cap = EXCLUDED.per_user_year_credit_cap,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = NOW()
     RETURNING credits_per_usd::text, per_user_year_credit_cap::text, updated_by_user_id, updated_at`,
    [input.creditsPerUsd ?? current.creditsPerUsd, input.perUserYearCreditCap ?? current.perUserYearCreditCap, input.actorUserId],
  );

  return mapConfig(result.rows[0]);
}

// --- member submissions ------------------------------------------------------------------------

export async function createSubmission(input: CreateContributionSubmissionInput): Promise<ContributionSubmission> {
  if (!isValidGiftCardAmount(input.claimedAmountUsd)) {
    throw new Error('invalid_amount');
  }
  const code = normalizeGiftCardCode(input.code);
  if (!code) {
    throw new Error('invalid_code');
  }

  const result = await queryDb<SubmissionRow>(
    `INSERT INTO contributions_submissions (user_id, kind, method, claimed_amount_usd, gift_card_code_encrypted)
     VALUES ($1, 'gift_card', 'amazon', $2, $3)
     RETURNING ${SUBMISSION_COLUMNS}`,
    [input.userId, input.claimedAmountUsd, encryptGiftCardCode(code, input.userId)],
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

export type RevealedCode = { found: false } | ({ found: true; userId: string } & DecryptedCode);

// One claim's code, for the admin redeeming it. A reviewed claim has no code left to show.
export async function revealSubmissionCode(submissionId: string): Promise<RevealedCode> {
  const result = await queryDb<{ user_id: string; gift_card_code_encrypted: string | null }>(
    `SELECT user_id, gift_card_code_encrypted FROM contributions_submissions WHERE id = $1`,
    [submissionId],
  );
  const row = result.rows[0];
  if (!row) return { found: false };
  if (!row.gift_card_code_encrypted) {
    return { found: true, userId: row.user_id, ok: false, reason: 'No code is stored for this claim: it was erased when the claim was reviewed, or the claim came in over Signal.' };
  }
  return { found: true, userId: row.user_id, ...decryptGiftCardCode(row.gift_card_code_encrypted, row.user_id) };
}

// Credits are an integer unit, so a grant is rounded before it is stored or minted. creditsPerUsd is
// admin-editable with no requirement to divide a dollar evenly, and the cap can be fractional, so
// this is the one place that holds whatever they are set to. A grant that rounds to 0 still confirms
// the claim with 0 credits.
function roundCredits(credits: number): number {
  return Math.round(credits);
}

async function computeYearCappedGrant(
  client: PoolClient,
  params: { userId: string; computedCredits: number; cap: number },
): Promise<number> {
  const result = await client.query<{ already_granted: string }>(
    // The larger of the two records over the last 365 days: the submissions (complete before a
    // deletion) and the kept ServiceCredits grants (kept after a deletion).
    `SELECT GREATEST(
       (SELECT COALESCE(SUM(credits_granted), 0) FROM contributions_submissions
         WHERE user_id = $1 AND status = 'confirmed' AND reviewed_at >= NOW() - INTERVAL '365 days'),
       (SELECT COALESCE(SUM(amount), 0) FROM service_credits_governance_events
         WHERE event_type = 'mint_grant' AND target_user_id = $1 AND reason = '${GRANT_REASON}'
           AND created_at >= NOW() - INTERVAL '365 days')
     )::text AS already_granted`,
    [params.userId],
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
  },
): Promise<SubmissionRow> {
  // The code is erased in the same statement that records the review.
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
       gift_card_code_encrypted = NULL,
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
    ],
  );

  return result.rows[0];
}

/**
 * Confirm a locked, still-pending claim. Credits = confirmedAmountUsd x credits_per_usd, clamped by
 * the per-member cap over the last 365 days; a positive grant goes through the canonical
 * service-credits mintGrant() (idempotency key `contribution-<submissionId>`).
 */
async function applyConfirmReview(
  client: PoolClient,
  row: SubmissionRow,
  input: ReviewContributionSubmissionInput,
): Promise<SubmissionRow> {
  // The admin types what was actually redeemed, which can differ from the claim, so it is checked
  // against the same integer-dollar rule rather than trusted.
  const confirmedAmountUsd = input.confirmedAmountUsd;
  if (!isValidGiftCardAmount(confirmedAmountUsd)) {
    throw new Error('confirmed_amount_required');
  }

  const config = await getContributionsConfigWithClient(client);
  const creditsGranted = await computeYearCappedGrant(client, {
    userId: row.user_id,
    computedCredits: confirmedAmountUsd * config.creditsPerUsd,
    cap: config.perUserYearCreditCap,
  });

  let governanceEventId: string | null = null;
  if (creditsGranted > 0) {
    // mintGrant is idempotent on its key, so a retried confirm cannot double-grant.
    const grant = await mintGrant({
      actorId: input.actorUserId,
      targetUserId: row.user_id,
      amount: creditsGranted,
      grantReason: GRANT_REASON,
      governanceTicketId: grantTicketId(input.submissionId),
      idempotencyKey: `contribution-${input.submissionId}`,
    });
    governanceEventId = grant.governanceEventId;
  }

  return applyReviewUpdate(client, {
    submissionId: input.submissionId,
    status: 'confirmed',
    actorUserId: input.actorUserId,
    reviewNote: input.reviewNote ?? null,
    confirmedAmountUsd,
    creditsGranted,
    creditGovernanceEventId: governanceEventId,
  });
}

/**
 * Confirm or reject a pending claim. Exactly once: the row is locked and must still be 'pending'.
 * Either way the stored code is erased. Rejection grants nothing.
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
      });
      return mapSubmissionForAdmin(updated);
    }

    const updated = await applyConfirmReview(client, row, input);
    return mapSubmissionForAdmin(updated);
  });
}

// --- audit log ----------------------------------------------------------------------------------

/** Append an audit row. Callers must never put a gift card code into metadata. */
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
