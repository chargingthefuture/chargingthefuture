// Platform-owned interface for the Unlock capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for Unlock: plugins must import
// it, never lib/unlock directly. Keep it narrow — a new export needs a reason, and re-exporting
// the whole repository is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
export { isUserUnlocked } from 'lib/unlock/access';
export { normalizeQuoraProfileUrl } from 'lib/unlock/quora-url';
export {
  createOrUpdateUnlockSubmission,
  getUnlockStatusForUser,
  insertUnlockAudit,
} from 'lib/unlock/repository';
