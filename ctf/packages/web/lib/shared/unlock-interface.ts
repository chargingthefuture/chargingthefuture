// Platform-owned interface for the Unlock capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for Unlock: plugins must import
// it, never lib/unlock directly. Keep it narrow — a new export needs a reason, and re-exporting
// the entire repository is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
export { isUserUnlocked } from 'lib/unlock/access';
export { normalizeQuoraProfileUrl } from 'lib/unlock/quora-url';
// The app-wide block a spam-denylisted Quora URL gets on submission (2026-10-05). The knowledge library
// opens an Unlock submission from a contribution, and without the same block that route was a way
// around the denylist.
export { applyDenylistBlockIfSpam } from 'lib/unlock/denylist-block';
export {
  createOrUpdateUnlockSubmission,
  getUnlockStatusForUser,
  insertUnlockAudit,
  // Of a set of user ids, which are approved — one query, returning a Set. Added for Fireside
  // (2026-09-13), which decides whether each comment in a thread is publicly visible by whether its
  // author is approved. Asking per author would be one lookup per comment on a public page, and
  // `isUserUnlocked` above answers for one person at a time. PeerProgramming already uses the same
  // function for cohort assignment, so this exposes an existing shape rather than a new one.
  listUnlockedUserIds,
} from 'lib/unlock/repository';
