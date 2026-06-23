#!/usr/bin/env node

// One-time port: bring v2 Quora verifications into v3 Unlock so returning members skip the Unlock
// screen and receive their 100-credit grant — without each having to re-submit.
//
// Context: v3's database is a clone of v2 prod, so the legacy `public.users` table is still present,
// including the `quora_profile_url` each member submitted in v2. This reads those and, for any user
// who does NOT already have a v3 Unlock submission, inserts an APPROVED submission
// (review_status = 'approved', access_tier = 'approved_full') carrying that Quora URL.
//
// It does NOT mint credits itself. The existing `reconcileUnlockRewards` job grants the 100-credit
// incentive idempotently for every approved-but-uncredited submission, so the next reconcile run
// grants each ported member their 100.
//
// SAFE BY DEFAULT — dry run. It prints what it WOULD insert and writes nothing unless APPLY=1 is set
// (or --apply is passed). Idempotent: `ON CONFLICT (user_id) DO NOTHING`, so a member who already has
// a v3 submission (already unlocked in v3, or already ported) is skipped — never overwritten, never
// double-granted.

import { Pool } from 'pg';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

const APPLY = process.env.APPLY === '1' || process.argv.includes('--apply');

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});

// Minimal normalization for the NOT NULL normalized column: trim, lowercase, drop a trailing slash.
// The reward grant does not depend on this; it just needs a stable, non-null value.
function normalizeQuora(url) {
  return String(url).trim().toLowerCase().replace(/\/+$/, '');
}

async function main() {
  // Guard: confirm the legacy users table has the columns we read before touching anything.
  const cols = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('id', 'quora_profile_url')`,
  );
  const have = new Set(cols.rows.map((r) => r.column_name));
  if (!have.has('id') || !have.has('quora_profile_url')) {
    throw new Error(
      `public.users is missing id and/or quora_profile_url — nothing to port (found: ${[...have].join(', ') || 'none'}).`,
    );
  }

  // v2 members who submitted a Quora URL. `username` is pulled too so a dry run can show who each
  // user id belongs to (Clerk cannot be searched by id from the dashboard); it comes from the v2
  // users table and may be null for an account that never set one.
  const candidates = await pool.query(
    `SELECT id::text AS user_id, username, quora_profile_url
       FROM public.users
      WHERE quora_profile_url IS NOT NULL
        AND TRIM(quora_profile_url) <> ''`,
  );

  // Those who already have a v3 Unlock submission are skipped (never overwrite / double-grant).
  const existing = await pool.query(`SELECT user_id FROM unlock_verification_submissions`);
  const existingIds = new Set(existing.rows.map((r) => r.user_id));
  const toPort = candidates.rows.filter((r) => r.user_id && !existingIds.has(r.user_id));

  console.log(`[quora-port] v2 users with a Quora URL: ${candidates.rows.length}`);
  console.log(`[quora-port] already have a v3 Unlock submission (skip): ${candidates.rows.length - toPort.length}`);
  console.log(`[quora-port] to port (new approved submissions): ${toPort.length}`);

  if (!APPLY) {
    // Dry run: print the full mapping so the operator can confirm who each user id is and match it
    // against the v2 Quora column before applying. The Quora URL shown is the value this port will
    // store; username is the v2 handle (or "(no username)" when the v2 row never set one).
    console.log('[quora-port] candidates — user_id | username | quora_profile_url:');
    for (const row of toPort) {
      console.log(`  ${row.user_id} | ${row.username || '(no username)'} | ${row.quora_profile_url}`);
    }
    console.log('[quora-port] DRY RUN — nothing written. Re-run with APPLY=1 to insert the approved submissions.');
    return;
  }

  let inserted = 0;
  for (const row of toPort) {
    const res = await pool.query(
      `INSERT INTO unlock_verification_submissions
         (user_id, access_tier, quora_profile_url, quora_profile_url_normalized,
          review_status, unlock_window_expires_at, reviewed_by_user_id, reviewed_at, review_note,
          created_at, updated_at)
       VALUES
         ($1, 'approved_full', $2, $3,
          'approved', NOW(), 'v2-quora-port', NOW(), 'Ported from v2 Quora verification',
          NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [row.user_id, row.quora_profile_url, normalizeQuora(row.quora_profile_url)],
    );
    inserted += res.rowCount;
  }
  console.log(`[quora-port] inserted ${inserted} approved submissions.`);
  console.log('[quora-port] The Unlock reward reconcile will grant each ported member 100 credits on its next run.');
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error('[quora-port] failed:', error);
    pool.end();
    process.exit(1);
  });
