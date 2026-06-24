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
