#!/usr/bin/env node

// ONE-OFF remediation for an accidental double-accept in SkillsHunt.
//
// The same person ("Katie Larkin") was nominated twice in the same round with
// different skill lists, so the per-round url+skills duplicate key did not catch
// it. Both were accepted, so both generated a Directory profile and both minted a
// ServiceCredits reward to the scout. This script voids the SECOND (lower-scored)
// submission and removes its auto-generated Directory profile.
//
// It does the two plain-row parts only, in one transaction, and is idempotent
// (safe to re-run): re-running finds the submission already rejected / the profile
// already soft-deleted and makes no further change.
//
// It deliberately does NOT touch the ServiceCredits ledger — that reversal is a
// Formance-mirrored operation and must go through the admin burn UI (see the
// printed follow-ups below), not raw SQL.
//
// Required env: DATABASE_URL (the app database).
//
// This is a throwaway script for a single incident. Delete it (and its workflow)
// once it has run successfully.

import { Pool } from 'pg';

// Incident-specific IDs (from the SELECT the operator ran in the Neon console).
const KEEP_ID = '4750e19e-fe2e-437d-9528-b4b8940a17ff'; // the +17 submission we keep
const VOID_ID = 'eb670ee0-0aca-4360-a0c7-741884da1cf5'; // the +12 duplicate we void
const ROUND_ID = '8d7b2817-7626-4302-9ef3-d7d7ecc99b63';
const SCOUT_ID = 'user_361l41OShkXubCMOt4nFwVzpSBj';
const BURN_AMOUNT = 1; // credit_amount minted for the duplicate accept

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) {
  console.error('[remediate] missing DATABASE_URL — nothing was changed.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock and verify the duplicate row is the one we expect.
    const dup = await client.query(
      `SELECT id, round_id, submitter_user_id, status, credit_amount
         FROM skills_hunt_submissions
        WHERE id = $1::uuid
        FOR UPDATE`,
      [VOID_ID],
    );
    if (dup.rowCount === 0) throw new Error(`void submission ${VOID_ID} not found`);
    const row = dup.rows[0];
    if (row.round_id !== ROUND_ID) throw new Error(`round mismatch on ${VOID_ID}: ${row.round_id}`);
    if (row.submitter_user_id !== SCOUT_ID) throw new Error(`submitter mismatch on ${VOID_ID}: ${row.submitter_user_id}`);

    // 2. Void the duplicate submission and clear its reward bookkeeping.
    if (row.status === 'rejected') {
      console.log(`[remediate] submission ${VOID_ID} already rejected — skipping void.`);
    } else if (row.status !== 'accepted') {
      throw new Error(`unexpected status '${row.status}' on ${VOID_ID} (expected 'accepted') — aborting.`);
    } else {
      await client.query(
        `UPDATE skills_hunt_submissions
            SET status = 'rejected',
                review_action = 'reject',
                review_notes = $2,
                reviewed_at = NOW(),
                credit_granted = FALSE,
                credit_amount = 0,
                credit_granted_at = NULL,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [VOID_ID, `Duplicate of ${KEEP_ID} — accidental double-accept remediation.`],
      );
      console.log(`[remediate] voided submission ${VOID_ID} (was accepted, credit_amount ${row.credit_amount}).`);
    }

    // 3. Soft-delete the auto-generated Directory profile, guarded so a claimed or
    //    non-community profile can never be touched.
    const link = await client.query(
      `SELECT directory_profile_id FROM skills_hunt_directory_profiles WHERE submission_id = $1::uuid`,
      [VOID_ID],
    );
    if (link.rowCount === 0) {
      console.log(`[remediate] no Directory profile linked to ${VOID_ID} — nothing to remove.`);
    } else {
      const dpid = link.rows[0].directory_profile_id;
      const del = await client.query(
        `UPDATE directory_profiles
            SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
          WHERE id::text = $1
            AND source = 'community-generated'
            AND claimed_by_user_id IS NULL
            AND deleted_at IS NULL`,
        [dpid],
      );
      if (del.rowCount === 1) {
        console.log(`[remediate] soft-deleted Directory profile ${dpid}.`);
      } else {
        console.log(`[remediate] Directory profile ${dpid} left untouched (already deleted, claimed, or not community-generated).`);
      }
    }

    // 4. Sanity check: the kept submission should still be accepted.
    const keep = await client.query(
      `SELECT status FROM skills_hunt_submissions WHERE id = $1::uuid`,
      [KEEP_ID],
    );
    console.log(`[remediate] kept submission ${KEEP_ID} status: ${keep.rows[0]?.status ?? 'NOT FOUND'}.`);

    await client.query('COMMIT');
    console.log('[remediate] committed.');
    console.log('');
    console.log('Manual follow-ups this script does NOT do:');
    console.log(`  1. Rebuild the leaderboard: in the SkillsHunt admin, re-accept the kept submission ${KEEP_ID}`);
    console.log('     (idempotent — the credit_granted guard means it will not pay again). This recomputes');
    console.log(`     the scout's score from the remaining accepted rows so the voided points drop off.`);
    console.log(`  2. Reverse the reward: in the ServiceCredits admin burn UI, burn ${BURN_AMOUNT} ServiceCredit`);
    console.log(`     from ${SCOUT_ID} (reason: duplicate SkillsHunt reward remediation). Raw SQL is not safe`);
    console.log('     here — the burn must post to the external ledger, which the admin burn does.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error('[remediate] FAILED:', error instanceof Error ? error.message : error);
    pool.end();
    process.exit(1);
  });
