#!/usr/bin/env node

// Report v2-ported Unlock submissions whose Clerk account no longer exists — the "ghost" / stranded
// rewards. When a member deletes their Clerk account directly (outside the app's Delete Account flow),
// the cloned v2 `public.users` row survives, so the one-time Quora port created an APPROVED submission
// and the reconcile job granted the 100-credit reward — all keyed to a dead Clerk id. This lists those
// rows so an operator can revoke them in a batch (Revoke reward in the Unlock admin, searchable by the
// Quora URL) instead of finding them one at a time.
//
// READ-ONLY: it writes nothing. It queries the ported submissions and asks Clerk whether each user
// still exists (404 → ghost). By default it prints the public Quora URL + reward state only — NOT the
// Clerk user ids, because the GitHub Actions log on this repo is world-readable. Pass `--show-ids` for
// a private/local run when you need the ids.

import { Pool } from 'pg';
import { createClerkClient } from '@clerk/backend';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

const SHOW_IDS = process.argv.includes('--show-ids');

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});

const clerk = createClerkClient({ secretKey: requireEnv('CLERK_SECRET_KEY') });

// True if the Clerk user exists, false on a 404. Any other error is rethrown so a transient Clerk
// failure never mislabels a live member as a ghost.
async function clerkUserExists(userId) {
  try {
    await clerk.users.getUser(userId);
    return true;
  } catch (error) {
    const status = error?.status ?? error?.statusCode;
    if (status === 404) return false;
    throw new Error(`Clerk lookup failed (status ${status ?? 'unknown'}): ${error?.message ?? error}`);
  }
}

async function main() {
  const res = await pool.query(
    `SELECT user_id, quora_profile_url, incentive_granted_at, reward_revoked_at, review_status
       FROM unlock_verification_submissions
      WHERE reviewed_by_user_id = 'v2-quora-port'
      ORDER BY created_at ASC`,
  );

  console.log(`[ghost-report] v2-ported submissions: ${res.rows.length}`);

  const ghosts = [];
  for (const row of res.rows) {
    // Sequential + best-effort: on any non-404 Clerk error we stop rather than risk a false "ghost".
    const exists = await clerkUserExists(row.user_id);
    if (!exists) ghosts.push(row);
  }

  const stillRewarded = ghosts.filter((g) => g.incentive_granted_at && !g.reward_revoked_at);
  console.log(`[ghost-report] ghosts (ported submission, Clerk user gone): ${ghosts.length}`);
  console.log(`[ghost-report]   of those, reward still granted and NOT revoked: ${stillRewarded.length}`);
  console.log('[ghost-report] ---');
  console.log('[ghost-report] Ghost rows — Revoke reward on these in the Unlock admin (search by URL):');
  for (const g of ghosts) {
    const rewardState = g.reward_revoked_at ? 'revoked' : g.incentive_granted_at ? 'reward-granted' : 'no-reward';
    const idPart = SHOW_IDS ? `${g.user_id}  ` : '';
    console.log(`  ${idPart}${g.quora_profile_url}  [${rewardState}]`);
  }
  if (!SHOW_IDS) {
    console.log('[ghost-report] (user ids hidden — re-run with --show-ids on a private/local run to include them.)');
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error('[ghost-report] failed:', error?.message ?? error);
  try {
    await pool.end();
  } catch {
    // no-trace: the pool is closing during a failure exit and nothing depends on it
  }
  process.exitCode = 1;
});
