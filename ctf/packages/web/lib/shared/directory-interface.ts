// Platform-owned interface for the Directory capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for Directory: plugins must import
// it, never lib/directory directly. Keep it narrow — a new export needs a reason, and re-exporting
// the whole repository is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
export {
  countActiveDirectoryProfiles,
  // Asks whether a Quora URL is on Directory's takedown list. SkillsHunt reads it so a nomination
  // of someone who asked to be removed is refused up front, rather than accepted and paid for.
  isQuoraUrlSuppressed,
  recordQuoraUrlChangeStandalone,
  // The survey records removed accounts as account history; a removed account has no URL, so it
  // cannot go through the URL recorder above.
  recordRemovedQuoraAccountStandalone,
  // Read back so the same closure is not recorded twice if someone answers the survey again.
  listRemovedQuoraAccountMarkers,
} from 'lib/directory/repository';
