// Platform-owned interface for the Unlock capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for Unlock: plugins must import
// it, never lib/unlock directly. Keep it narrow — a new export needs a reason, and re-exporting
// the entire repository is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
export { isUserUnlocked } from 'lib/unlock/access';
// The member's tier, for the AI Assistant's Unlock help path (2026-09-26): it answers Unlock questions
// only for a member not yet approved, and `isUserUnlocked` does not tell those tiers apart from an
// unreadable one. Read-only.
export { getUnlockAccessTier } from 'lib/unlock/access';
// The Quora profile URL steps, shared with the AI Assistant so its scripted answer and the Unlock
// help box say the same thing (2026-09-26). Pure data.
export { QUORA_URL_HELP_STEPS, type QuoraUrlHelpCase } from 'lib/unlock/quora-url-help-steps';
export { normalizeQuoraProfileUrl } from 'lib/unlock/quora-url';
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
