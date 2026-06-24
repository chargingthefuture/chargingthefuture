#!/usr/bin/env node
/*
 * SkillsHunt end-to-end smoke check.
 *
 * Verifies the full chain that the rewrite checklist asks for:
 *
 *   rounds list -> submit -> admin accept -> leaderboard rebuild
 *     -> notification fan-out -> unclaimed Directory profile with @handle
 *
 * Strategy: run against the live DB AFTER seedSkillsHunt.mjs has
 * already populated deterministic fixtures (seed round + accepted seed
 * submission + linked community-generated profile). The smoke script
 * asserts on the post-state. If you re-run the seed and then this, all
 * assertions should still pass — both scripts are idempotent.
 *
 * Required env: DATABASE_URL.
 * Exit codes: 0 on full pass, 1 on first assertion failure.
 */

import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

const SEED_ROUND_ID = '33333333-3333-4333-8333-333333333333';
const SEED_SUBMISSION_ID = '44444444-4444-4444-8444-444444444444';
const SEED_DIRECTORY_PROFILE_ID = '00000000-0000-0000-0000-00005ee15ed1';
const SEED_USERNAME = 'seed-user-01';
const SEED_HANDLE = 'community-seed01';

async function assertRow(name, query, params, predicate) {
  const result = await query;
  const rows = result.rows ?? [];
  if (rows.length === 0) throw new Error(`[FAIL] ${name}: expected at least one row, got 0`);
  const row = rows[0];
  const errors = [];
  for (const [key, expected] of Object.entries(predicate)) {
    const got = row[key];
    const ok = typeof expected === 'function' ? expected(got) : got === expected;
    if (!ok) errors.push(`  ${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
  if (errors.length) throw new Error(`[FAIL] ${name}:\n${errors.join('\n')}`);
  console.log(`  [ok] ${name}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('SkillsHunt end-to-end smoke check\n');

  try {
    // 1. Round is listable as active.
    await assertRow(
      'rounds list — active seed round exists',
      client.query(`SELECT id, status FROM skills_hunt_rounds WHERE id = $1::uuid`, [SEED_ROUND_ID]),
      [SEED_ROUND_ID],
      { status: 'active' },
    );

    // 2-3. Submission was accepted (admin accept simulated by the seed).
    await assertRow(
      'submission accepted with SPEC scoring',
      client.query(
        `SELECT status, points_awarded, url_validation_result,
                COALESCE((score_breakdown->>'matchBase')::int, 0) AS match_base,
                COALESCE((score_breakdown->>'firstMatchBonus')::int, 0) AS first_match
         FROM skills_hunt_submissions WHERE id = $1::uuid AND deleted_at IS NULL`,
        [SEED_SUBMISSION_ID],
      ),
      [SEED_SUBMISSION_ID],
      {
        status: 'accepted',
        url_validation_result: 'valid',
        match_base: (v) => v === 10,
        first_match: (v) => v === 5,
        points_awarded: (v) => v >= 17,
      },
    );

    // 4. Leaderboard rebuild populated the new Wave 2 columns.
    await assertRow(
      'leaderboard rebuild wrote first_match_count + last_submission_at',
      client.query(
        `SELECT rank, score, first_match_count, last_submission_at
         FROM skills_hunt_leaderboard
         WHERE round_id = $1::uuid AND mode = 'individual' AND user_id = $2
         ORDER BY rank ASC LIMIT 1`,
        [SEED_ROUND_ID, SEED_USERNAME],
      ),
      [],
      {
        rank: 1,
        first_match_count: (v) => v === 1,
        last_submission_at: (v) => v != null,
      },
    );

    // 5. Notification was emitted (submission-accepted fan-out).
    await assertRow(
      'notification fan-out wrote submission-accepted row',
      client.query(
        `SELECT kind, title FROM skills_hunt_notifications
         WHERE user_id = $1 AND kind = 'submission-accepted'
         ORDER BY created_at DESC LIMIT 1`,
        [SEED_USERNAME],
      ),
      [],
      { kind: 'submission-accepted' },
    );

    // 6. Unclaimed Directory profile exists with @handle + community-generated source.
    await assertRow(
      'directory profile is community-generated with unclaimed_handle',
      client.query(
        `SELECT source, unclaimed_handle, invited_by_username, is_public, deleted_at
         FROM directory_profiles WHERE id = $1::uuid`,
        [SEED_DIRECTORY_PROFILE_ID],
      ),
      [SEED_DIRECTORY_PROFILE_ID],
      {
        source: 'community-generated',
        unclaimed_handle: SEED_HANDLE,
        invited_by_username: SEED_USERNAME,
        is_public: true,
        deleted_at: null,
      },
    );

    // 6b. @handle is unique (the partial UNIQUE index would catch dupes;
    // this just confirms the seed handle is the only one with that value).
    await assertRow(
      '@handle uniqueness — only one row owns community-seed01',
      client.query(
        `SELECT COUNT(*)::int AS total FROM directory_profiles
         WHERE LOWER(unclaimed_handle) = $1 AND deleted_at IS NULL`,
        [SEED_HANDLE],
      ),
      [SEED_HANDLE],
      { total: 1 },
    );

    // 7. Audit log row was written for the seed flow (regulatory retention).
    // Tighten the predicate so the assertion is meaningful: require ≥ 1 row
    // for the seed actor on a SkillsHunt command.
    await assertRow(
      'audit log retained at least one entry for the seed actor',
      client.query(
        `SELECT COUNT(*)::int AS total FROM skills_hunt_audit_log
         WHERE actor_id = $1 AND command LIKE 'skills-hunt.%'`,
        [SEED_USERNAME],
      ),
      [],
      { total: (v) => v > 0 },
    );

    console.log('\nAll SkillsHunt smoke assertions passed.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n' + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
