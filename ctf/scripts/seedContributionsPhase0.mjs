#!/usr/bin/env node

// Contributions seed — runtime config singleton and three demo gift card claims in mixed statuses.
// Deterministic UUIDs and fixed timestamps so re-running is idempotent and byte-for-byte stable.
//
// No gift card code anywhere: a real code is sealed with CONTRIBUTIONS_CODE_KEY by the app, and a
// reviewed claim has none left. The pending claim therefore shows "No code is stored".

import { Pool } from 'pg';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});

const seedMemberId = 'seed-contributions-member-001';
const seedSecondMemberId = 'seed-contributions-member-002';
const seedAdminId = 'seed-contributions-admin-001';

// Deterministic UUIDs (hex-only) so ON CONFLICT (id) DO UPDATE keeps re-runs idempotent.
const SUBMISSION_GIFT_CARD_PENDING = '00000000-c0de-4000-a000-000000000101';
const SUBMISSION_GIFT_CARD_CONFIRMED = '00000000-c0de-4000-a000-000000000102';
const SUBMISSION_GIFT_CARD_REJECTED = '00000000-c0de-4000-a000-000000000103';

const REVIEWED_AT = '2026-06-05T00:00:00.000Z';

async function upsertRuntimeConfig(client) {
  await client.query(
    `
      INSERT INTO contributions_runtime_config (id, credits_per_usd, per_user_year_credit_cap, updated_by_user_id, updated_at)
      VALUES (TRUE, 10, 300, $1, NOW())
      ON CONFLICT (id) DO UPDATE SET
        credits_per_usd = EXCLUDED.credits_per_usd,
        per_user_year_credit_cap = EXCLUDED.per_user_year_credit_cap,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
    `,
    [seedAdminId],
  );
}

async function upsertSubmission(client, submission) {
  await client.query(
    `
      INSERT INTO contributions_submissions (
        id, user_id, kind, method, claimed_amount_usd, status, confirmed_amount_usd, credits_granted,
        credit_governance_event_id, reviewed_by_user_id, reviewed_at, review_note
      )
      VALUES ($1::uuid, $2, 'gift_card', 'amazon', $3, $4, $5, $6, NULL, $7, $8::timestamptz, $9)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        kind = EXCLUDED.kind,
        method = EXCLUDED.method,
        claimed_amount_usd = EXCLUDED.claimed_amount_usd,
        status = EXCLUDED.status,
        confirmed_amount_usd = EXCLUDED.confirmed_amount_usd,
        credits_granted = EXCLUDED.credits_granted,
        credit_governance_event_id = EXCLUDED.credit_governance_event_id,
        reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
        reviewed_at = EXCLUDED.reviewed_at,
        review_note = EXCLUDED.review_note,
        updated_at = NOW()
    `,
    [
      submission.id,
      submission.userId,
      submission.claimedAmountUsd,
      submission.status,
      submission.confirmedAmountUsd ?? null,
      submission.creditsGranted ?? 0,
      submission.reviewedByUserId ?? null,
      submission.reviewedAt ?? null,
      submission.reviewNote ?? null,
    ],
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await upsertRuntimeConfig(client);

    const submissions = [
      { id: SUBMISSION_GIFT_CARD_PENDING, userId: seedMemberId, claimedAmountUsd: 25, status: 'pending' },
      {
        // Confirmed at 10 credits per dollar. Display-only demo data: no real governance event
        // backs it, so credit_governance_event_id stays null.
        id: SUBMISSION_GIFT_CARD_CONFIRMED,
        userId: seedSecondMemberId,
        claimedAmountUsd: 10,
        status: 'confirmed',
        confirmedAmountUsd: 10,
        creditsGranted: 100,
        reviewedByUserId: seedAdminId,
        reviewedAt: REVIEWED_AT,
        reviewNote: 'Seed demo: redeemed.',
      },
      {
        // Rejected (the code did not redeem). Rejection grants nothing.
        id: SUBMISSION_GIFT_CARD_REJECTED,
        userId: seedMemberId,
        claimedAmountUsd: 15,
        status: 'rejected',
        reviewedByUserId: seedAdminId,
        reviewedAt: REVIEWED_AT,
        reviewNote: 'Seed demo: the code did not redeem.',
      },
    ];

    for (const submission of submissions) {
      await upsertSubmission(client, submission);
    }

    await client.query('COMMIT');
    console.log('contributions seed fixtures applied.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
