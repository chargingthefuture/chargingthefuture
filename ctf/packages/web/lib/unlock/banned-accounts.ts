import { queryDb } from 'lib/db/postgres';
import type { UnlockBannedAccount } from './types';

// The accounts an admin has banned outright: people who signed up, behaved badly enough to be judged,
// and should not hold a login anywhere this project runs.
//
// This is a different thing from the demo/test exclusion next door. That list is fiction an admin
// created and the counters ignore; this list is real people who really signed up, recorded so the
// pattern stays countable. Nothing here is deleted, because these rows are the record of who arrived
// and what they did, and that record is the argument.
//
// A row here is paired with a ban at the auth provider (lib/unlock/provider-ban.ts). The row is what
// the admin page reads; the provider ban is what actually stops a sign-in, here and on anything else
// the provider fronts. Keyed on the provider's user id, one row per banned account.

type UnlockBannedAccountRow = {
  user_id: string;
  reason: string;
  note: string | null;
  banned_by_user_id: string | null;
  provider_applied: boolean;
  created_at: Date;
  updated_at: Date;
};

function mapBannedAccount(row: UnlockBannedAccountRow): UnlockBannedAccount {
  return {
    userId: row.user_id,
    reason: row.reason,
    note: row.note,
    bannedByUserId: row.banned_by_user_id,
    providerApplied: row.provider_applied,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Every banned account, newest ban first.
export async function listUnlockBannedAccounts(): Promise<UnlockBannedAccount[]> {
  const result = await queryDb<UnlockBannedAccountRow>(
    `SELECT user_id, reason, note, banned_by_user_id, provider_applied, created_at, updated_at
       FROM unlock_banned_accounts
      ORDER BY created_at DESC`,
  );

  return result.rows.map(mapBannedAccount);
}

// Record a ban. Idempotent: re-banning an account already on the list refreshes its reason, note, who
// banned it and whether the provider applied it rather than failing, so a second press of the button
// is harmless and a retry that the provider accepts clears the refusal.
export async function addUnlockBannedAccount(input: {
  userId: string;
  reason: string;
  note: string | null;
  actorUserId: string;
  providerApplied: boolean;
}): Promise<void> {
  await queryDb(
    `INSERT INTO unlock_banned_accounts (user_id, reason, note, banned_by_user_id, provider_applied, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET reason = EXCLUDED.reason,
         note = EXCLUDED.note,
         banned_by_user_id = EXCLUDED.banned_by_user_id,
         provider_applied = EXCLUDED.provider_applied,
         updated_at = NOW()`,
    [input.userId, input.reason, input.note, input.actorUserId, input.providerApplied],
  );
}

// The stored reason for an account's ban, or null when it is not on the list. A review decision reads
// it so it only ever lifts or overwrites the bans it owns (spam, duplicate), never one placed from the
// sign-up list.
export async function getUnlockBannedReason(userId: string): Promise<string | null> {
  const result = await queryDb<{ reason: string }>(
    `SELECT reason FROM unlock_banned_accounts WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.reason ?? null;
}

// Lift a ban. Idempotent: removing an account that was never banned is a no-op.
export async function removeUnlockBannedAccount(userId: string): Promise<void> {
  await queryDb(`DELETE FROM unlock_banned_accounts WHERE user_id = $1`, [userId]);
}
