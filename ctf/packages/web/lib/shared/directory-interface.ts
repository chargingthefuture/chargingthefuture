// Platform-owned interface for the Directory capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for Directory: plugins must import
// it, never lib/directory directly. Keep it narrow — a new export needs a reason, and re-exporting
// the whole repository is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
export {
  countActiveDirectoryProfiles,
  // The signed-in member's own claimed Directory profile. Workforce reads it for the What's Your
  // 1% card, which shows a member their own name, occupation and skills and nobody else's. Added
  // 2026-09-14: the card is built from the Directory's own listing rather than a second copy of a
  // member's skills, so there is one place a skill is recorded and the card cannot drift from it.
  getOwnProfile,
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

// The set of things that can change a member's Quora URL. Unlock names one when it records a change,
// so its own helper can be typed without reaching into lib/directory directly.
export type { QuoraUrlChangeSource } from 'lib/directory/repository';
