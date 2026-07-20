#!/usr/bin/env node

// Contributions seed — runtime config singleton, one demo fundraiser cycle, and three demo
// claims in mixed statuses. Deterministic UUIDs and fixed timestamps so re-running is
// idempotent and byte-for-byte stable.
//
// Privacy rules baked in: NO gift-card code anywhere (the platform never stores codes), and
// NO real Signal contact — the config copy and the demo claim use placeholder text only.

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
const CYCLE_ID = '00000000-c0de-4000-a000-000000000001';
const SUBMISSION_GIFT_CARD_PENDING = '00000000-c0de-4000-a000-000000000101';
const SUBMISSION_QUORA_CONFIRMED = '00000000-c0de-4000-a000-000000000102';
const SUBMISSION_STAR_REJECTED = '00000000-c0de-4000-a000-000000000103';

// Fixed three-month window that contains the seed authoring date (2026-06-10).
const CYCLE_STARTS_AT = '2026-05-01T00:00:00.000Z';
const CYCLE_ENDS_AT = '2026-08-01T00:00:00.000Z';
const REVIEWED_AT = '2026-06-05T00:00:00.000Z';

// Placeholder copy only — never a real Signal handle or phone number.
const SIGNAL_INSTRUCTIONS_PLACEHOLDER =
  'Thank you. Send the gift-card code to the owner over Signal only (contact details are shared ' +
  'in the app, not in this seed). Never post a code anywhere else. For every other question, use ' +
  'the public Hub support channel.';

const SIGNAL_CONTACT_PLACEHOLDER = 'https://signal.example/seed-demo-contact';

async function upsertRuntimeConfig(client) {
  await client.query(
    `
      INSERT INTO contributions_runtime_config (
        id, credits_per_usd, non_monetary_unit_value_usd, per_user_cycle_credit_cap,
        banner_snooze_months, banner_enabled, signal_instructions, updated_by_user_id, updated_at
      )
      VALUES (TRUE, 10, 1, 300, 2, TRUE, $1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET
        credits_per_usd = EXCLUDED.credits_per_usd,
        non_monetary_unit_value_usd = EXCLUDED.non_monetary_unit_value_usd,
        per_user_cycle_credit_cap = EXCLUDED.per_user_cycle_credit_cap,
        banner_snooze_months = EXCLUDED.banner_snooze_months,
        banner_enabled = EXCLUDED.banner_enabled,
        signal_instructions = EXCLUDED.signal_instructions,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
    `,
    [SIGNAL_INSTRUCTIONS_PLACEHOLDER, seedAdminId],
  );
}

async function upsertCycle(client) {
  await client.query(
    `
      INSERT INTO contributions_cycles (
        id, starts_at, ends_at, fiat_goal_usd, quora_comment_goal, github_star_goal, created_by_user_id
      )
      VALUES ($1::uuid, $2::timestamptz, $3::timestamptz, 100, 50, 25, $4)
      ON CONFLICT (id) DO UPDATE SET
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        fiat_goal_usd = EXCLUDED.fiat_goal_usd,
        quora_comment_goal = EXCLUDED.quora_comment_goal,
        github_star_goal = EXCLUDED.github_star_goal,
        created_by_user_id = EXCLUDED.created_by_user_id,
        updated_at = NOW()
    `,
    [CYCLE_ID, CYCLE_STARTS_AT, CYCLE_ENDS_AT, seedAdminId],
  );
}

async function upsertSubmission(client, submission) {
  await client.query(
    `
      INSERT INTO contributions_submissions (
        id, user_id, kind, method, claimed_amount_usd, signal_contact, quora_post_url,
        github_profile_url, status, confirmed_amount_usd, credits_granted,
        credit_governance_event_id, cycle_id, reviewed_by_user_id, reviewed_at, review_note
      )
      VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::uuid, $14, $15::timestamptz, $16
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        kind = EXCLUDED.kind,
        method = EXCLUDED.method,
        claimed_amount_usd = EXCLUDED.claimed_amount_usd,
        signal_contact = EXCLUDED.signal_contact,
        quora_post_url = EXCLUDED.quora_post_url,
        github_profile_url = EXCLUDED.github_profile_url,
        status = EXCLUDED.status,
        confirmed_amount_usd = EXCLUDED.confirmed_amount_usd,
        credits_granted = EXCLUDED.credits_granted,
        credit_governance_event_id = EXCLUDED.credit_governance_event_id,
        cycle_id = EXCLUDED.cycle_id,
        reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
        reviewed_at = EXCLUDED.reviewed_at,
        review_note = EXCLUDED.review_note,
        updated_at = NOW()
    `,
    [
      submission.id,
      submission.userId,
      submission.kind,
      submission.method ?? null,
      submission.claimedAmountUsd ?? null,
      submission.signalContact ?? null,
      submission.quoraPostUrl ?? null,
      submission.githubProfileUrl ?? null,
      submission.status,
      submission.confirmedAmountUsd ?? null,
      submission.creditsGranted ?? 0,
      submission.creditGovernanceEventId ?? null,
      submission.cycleId ?? null,
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
    await upsertCycle(client);

    const submissions = [
      {
        // Pending gift-card claim. The CODE is never stored — only the member's (placeholder)
        // Signal contact so the owner can match the code they receive over Signal.
        id: SUBMISSION_GIFT_CARD_PENDING,
        userId: seedMemberId,
        kind: 'gift_card',
        method: 'amazon',
        claimedAmountUsd: 25,
        signalContact: SIGNAL_CONTACT_PLACEHOLDER,
        status: 'pending',
        cycleId: CYCLE_ID,
      },
      {
        // Confirmed Quora-comment claim: valued at the $1 non-monetary unit, granted 10 credits
        // (10 credits per USD). Display-only demo data: no real governance event backs it, so
        // credit_governance_event_id stays null.
        id: SUBMISSION_QUORA_CONFIRMED,
        userId: seedSecondMemberId,
        kind: 'quora_comment',
        quoraPostUrl: 'https://www.quora.com/profile/seed-demo/answers/example',
        status: 'confirmed',
        confirmedAmountUsd: 1,
        creditsGranted: 10,
        cycleId: CYCLE_ID,
        reviewedByUserId: seedAdminId,
        reviewedAt: REVIEWED_AT,
        reviewNote: 'Seed demo: confirmed comment.',
      },
      {
        // Rejected GitHub-star claim (could not be verified). Rejection grants nothing.
        id: SUBMISSION_STAR_REJECTED,
        userId: seedMemberId,
        kind: 'github_star',
        githubProfileUrl: 'https://github.com/seed-demo-profile',
        status: 'rejected',
        cycleId: CYCLE_ID,
        reviewedByUserId: seedAdminId,
        reviewedAt: REVIEWED_AT,
        reviewNote: 'Seed demo: star not found on the repo.',
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
