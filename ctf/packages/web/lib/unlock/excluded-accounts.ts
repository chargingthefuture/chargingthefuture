import { queryDb } from 'lib/db/postgres';
import type { UnlockExcludedAccount } from './types';

// The accounts the Unlock admin's sign-up counters leave out: the owner's demo/recording accounts and
// any other test account. Nothing on the account itself says "this is not a real member", so an admin
// marks it here and every sign-up number on the Unlock admin page subtracts it. Keyed on the auth
// provider's user id, one row per excluded account.

type UnlockExcludedAccountRow = {
  user_id: string;
  note: string | null;
  excluded_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapExcludedAccount(row: UnlockExcludedAccountRow): UnlockExcludedAccount {
  return {
    userId: row.user_id,
    note: row.note,
    excludedByUserId: row.excluded_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// A SQL condition that leaves out the accounts marked here, for every reading that counts members
// (the Adoption measures, the daily exchange). One fragment so the readings cannot drift apart.
// `column` is the account id column of the row being counted; the table exists in the demo schema
// too, so a reading there filters against the demo copy.
export function notExcludedAccount(column: string): string {
  return `${column} NOT IN (SELECT user_id FROM unlock_excluded_accounts)`;
}

// Every excluded account, newest mark first.
export async function listUnlockExcludedAccounts(): Promise<UnlockExcludedAccount[]> {
  const result = await queryDb<UnlockExcludedAccountRow>(
    `SELECT user_id, note, excluded_by_user_id, created_at, updated_at
       FROM unlock_excluded_accounts
      ORDER BY created_at DESC`,
  );

  return result.rows.map(mapExcludedAccount);
}

// Mark an account as demo/test so the sign-up counters stop counting it. Idempotent: re-marking an
// account already on the list refreshes its note and who marked it rather than failing.
export async function addUnlockExcludedAccount(input: {
  userId: string;
  note: string | null;
  actorUserId: string;
}): Promise<void> {
  await queryDb(
    `INSERT INTO unlock_excluded_accounts (user_id, note, excluded_by_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET note = EXCLUDED.note,
         excluded_by_user_id = EXCLUDED.excluded_by_user_id,
         updated_at = NOW()`,
    [input.userId, input.note, input.actorUserId],
  );
}

// Put an account back in the counts. Idempotent: removing an account that was never marked is a no-op.
export async function removeUnlockExcludedAccount(userId: string): Promise<void> {
  await queryDb(`DELETE FROM unlock_excluded_accounts WHERE user_id = $1`, [userId]);
}
