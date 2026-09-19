// Platform-owned interface for "a member was just approved in Unlock" (owner decision 2026-08-03:
// strict plugin isolation). This file is the sanctioned crossing point in that direction, the way
// unlock-interface.ts is the crossing point in the other one.
//
// Why it exists. Approval in this app is retroactive and per person: everything somebody has
// already written becomes visible at once, one decision rather than one per item. That is the right
// shape, and it leaves each plugin with a debt it cannot pay on its own — anything it held back
// while the member waited, it held back silently, and it has no way to learn the moment that
// changed. Without this the Unlock review route would have to import each plugin that has catch-up
// work, which is exactly the coupling rule 112 forbids and exactly what a second plugin needing the
// same hook would make worse.
//
// Keep it narrow. A plugin belongs here only when approval leaves it owing somebody something it
// cannot deliver later by itself. Reading approval state is not that — a plugin does that for
// itself through listUnlockedUserIds in unlock-interface.ts, at the moment it needs the answer.

import { reportError } from 'lib/observability/report';
// Only a top-level *-interface.ts in this folder may import a plugin's lib, which is what
// check-plugin-boundaries.mjs enforces. That is why this file is the one doing it.
import { announceHeldReplies } from 'lib/fireside/approval-catch-up';

/** What each plugin did about the approval, for the audit row the caller writes. */
export type UnlockApprovalCatchUp = {
  /** People told that a held reply of this member's answered their comment. */
  firesideRepliesAnnounced: number;
};

/**
 * Run every plugin's catch-up for a member Unlock has just approved.
 *
 * Best-effort throughout, and deliberately so: the approval itself is already committed by the time
 * this runs, and an admin who approved somebody must not see that fail because a notification did.
 * A plugin that throws is reported and the rest still run — one plugin's bad day is not a reason
 * for another's debt to go unpaid.
 *
 * Idempotent, because it has to be. An account can be re-reviewed, and each plugin's catch-up is
 * written so a second run tells nobody a second time.
 */
export async function runUnlockApprovalCatchUp(userId: string): Promise<UnlockApprovalCatchUp> {
  let firesideRepliesAnnounced = 0;

  try {
    firesideRepliesAnnounced = await announceHeldReplies(userId);
  } catch (error) {
    reportError(error, { area: 'unlock-approval-catch-up', op: 'fireside_held_replies' });
  }

  return { firesideRepliesAnnounced };
}
