import type { PoolClient } from 'pg';

// One claimed Directory listing per account.
//
// `directory_profiles.claimed_by_user_id` carries no unique index, because production may already
// hold accounts with two claimed listings and a unique index cannot be created over them. So the two
// writers that make a listing claimed (a member's own first save, and an admin assigning a listing)
// take this lock and check before writing, and every reader of "the member's profile" orders its
// single-row read the same way, so an account that already has two always resolves to the same one.

// The oldest listing first, with the id as a tie-break. Callers alias directory_profiles as `p`.
export const OWNED_PROFILE_ORDER_SQL = 'p.created_at ASC, p.id::text ASC';

// Serializes claim writes for one account until the surrounding transaction ends. The first key
// namespaces the lock so it cannot collide with another feature's advisory locks.
export async function lockAccountProfileClaim(client: PoolClient, userId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('directory_profiles.claimed_by_user_id'), hashtext($1))`, [userId]);
}
