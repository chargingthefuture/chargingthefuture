import type { PoolClient } from 'pg';
import { queryDb } from 'lib/db/postgres';

// Product-wide member blocking — the cross-cutting data layer (issue #809, owner-signed model
// 2026-06-24). A block is created one-way by a member (the blocker) against another (the blocked),
// is invisible to the blocked person, and suppresses contact/visibility in BOTH directions. So the
// enforcement check below is SYMMETRIC: once A blocks B, neither A nor B can see or reach the other
// on member-to-member surfaces.
//
// This mirrors how unlock gating is a single shared check that every surface calls (see
// lib/unlock/access.ts): one helper, one query, consulted everywhere. Order of checks on a hot path
// is unlock gate first, then this block check (per the signed-off model).
//
// Caching: none, deliberately. The unlock gate does not memoize per request either; it issues one
// indexed query per call. The block check is a single EXISTS against the
// (blocker_user_id, blocked_user_id) unique index and the reverse (blocked_user_id, blocker_user_id)
// index — both directions are index-served, so the read is cheap. A request-scoped memo would be a
// caching layer not matched anywhere else in this lib, so it is omitted; revisit only if profiling
// shows the same pair re-checked many times in one request.

// True when a block exists in EITHER direction between the two users — (blocker=userA, blocked=userB)
// OR (blocker=userB, blocked=userA). This is the single check every member-to-member surface consults
// before letting two members see or contact each other. Parameterized; never interpolate ids into SQL.
//
// If userA === userB the OR-pair simply won't match (a member cannot block themselves — enforced by
// the member_blocks_no_self_block CHECK), so it returns false without needing a special case.
export async function isBlockedBetween(userA: string, userB: string): Promise<boolean> {
  const result = await queryDb<{ blocked: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM member_blocks
       WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
          OR (blocker_user_id = $2 AND blocked_user_id = $1)
     ) AS blocked`,
    [userA, userB],
  );

  return result.rows[0]?.blocked ?? false;
}

// Same check as isBlockedBetween, but on the caller's open transaction client — for enforcement
// inside a write transaction (e.g. a claim or offer), so the check and the write see one snapshot
// and no second pool connection is taken mid-transaction.
export async function isBlockedBetweenTx(client: PoolClient, userA: string, userB: string): Promise<boolean> {
  const result = await client.query<{ blocked: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM member_blocks
       WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
          OR (blocker_user_id = $2 AND blocked_user_id = $1)
     ) AS blocked`,
    [userA, userB],
  );

  return result.rows[0]?.blocked ?? false;
}

// --- Member block management (issue #809, task 2) ---------------------------------------------
//
// These three functions back the block / unblock / manage-list flow. A block is created one-way by
// the blocker against the blocked person, is invisible to the blocked person, and carries no reason
// (ordinary blocks are private — the admin never reads them). The enforcement check above is what
// makes a block take effect across surfaces; these functions only own the create/remove/list of a
// member's own boundary. Every query is parameterized — ids are never interpolated into SQL.

// Thrown by blockUser when the blocker and target are the same person. The database also enforces
// this with the member_blocks_no_self_block CHECK, but we reject it here first so the route can map
// it to a clear 400 without relying on a database round-trip and constraint error.
export class SelfBlockError extends Error {
  constructor() {
    super('A member cannot block themselves.');
    this.name = 'SelfBlockError';
  }
}

// One row in the signed-in member's block list, shaped for the manage-list UI: who they blocked, a
// resolved human display label for that person, and when the block was created.
export interface MemberBlockListItem {
  blockedUserId: string;
  displayName: string;
  createdAtIso: string;
}

// Create a block: blockerUserId hides/silences blockedUserId. Idempotent — blocking the same person
// twice is a no-op (ON CONFLICT DO NOTHING on the (blocker, blocked) unique constraint), so the
// route can always return ok. Rejects a self-block defensively before touching the database.
export async function blockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  if (blockerUserId === blockedUserId) {
    throw new SelfBlockError();
  }

  await queryDb(
    `INSERT INTO member_blocks (blocker_user_id, blocked_user_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING`,
    [blockerUserId, blockedUserId],
  );
}

// Same create-block insert, but issued on the caller's transaction client. Used by the create-block
// route when the member also raised a safety report (issue #809, task 3): the block and the report
// are written in one transaction so they succeed or fail together. Idempotent for the same reason as
// blockUser. Rejects a self-block defensively before touching the database.
export async function blockUserTx(
  client: PoolClient,
  blockerUserId: string,
  blockedUserId: string,
): Promise<void> {
  if (blockerUserId === blockedUserId) {
    throw new SelfBlockError();
  }

  await client.query(
    `INSERT INTO member_blocks (blocker_user_id, blocked_user_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING`,
    [blockerUserId, blockedUserId],
  );
}

// Remove a block (unblock). Idempotent — deleting a block that does not exist succeeds with no rows
// affected, so the route can always return ok and the manage-list never errors on a double-unblock.
export async function unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  await queryDb(
    `DELETE FROM member_blocks
     WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
    [blockerUserId, blockedUserId],
  );
}

// List the blocks this member created, newest first, each with the blocked person's resolved display
// label. The label is the blocked member's claimed Directory profile name (first + last); when there
// is no claimed profile we fall back to a neutral "Member" so the row still names someone the viewer
// can recognize and unblock. LEFT JOIN so a missing profile never drops the block from the list.
export async function listBlocksForUser(blockerUserId: string): Promise<MemberBlockListItem[]> {
  const result = await queryDb<{
    blocked_user_id: string;
    display_name: string | null;
    created_at: Date;
  }>(
    `SELECT
       mb.blocked_user_id,
       NULLIF(TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.last_name, '')), '') AS display_name,
       mb.created_at
     FROM member_blocks mb
     LEFT JOIN directory_profiles dp
       ON dp.claimed_by_user_id = mb.blocked_user_id
      AND dp.deleted_at IS NULL
     WHERE mb.blocker_user_id = $1
     ORDER BY mb.created_at DESC`,
    [blockerUserId],
  );

  return result.rows.map((row) => ({
    blockedUserId: row.blocked_user_id,
    displayName: row.display_name?.trim() ? row.display_name.trim() : 'Member',
    createdAtIso: new Date(row.created_at).toISOString(),
  }));
}
