export type DirectoryProfileSource = 'admin' | 'self' | 'community-generated';

export type DirectoryProfile = {
  id: string;
  claimedByUserId: string | null;
  firstName: string;
  lastName: string | null;
  headline: string | null;
  bio: string | null;
  profileUrl: string | null;
  sectorId: string | null;
  sectorName: string | null;
  jobTitleId: string | null;
  jobTitleName: string | null;
  skills: Array<{ id: string; name: string; displayOrder: number }>;
  // Free-text skills that were nominated for this profile through SkillsHunt but
  // are not yet in the canonical taxonomy. They live in
  // skills_hunt_proposed_skill_promotions (status not yet 'promoted'), joined to the
  // profile via the originating submission (skills_hunt_directory_profiles). Surfaced
  // as muted "pending review" chips so a community-generated profile is never empty
  // just because its nominated skill has not been promoted yet.
  pendingSkills: string[];
  // Free-text skills the member added to their OWN profile through the self-edit form (the
  // "skill not listed" box). These are the editable subset of pendingSkills — they round-trip
  // into the edit form so the owner can change or remove them, whereas SkillsHunt-nominated
  // pending skills are not self-editable. Stored in directory_profile_proposed_skills.
  proposedSkills: string[];
  isActive: boolean;
  // SkillsHunt + Clerk username co-change (continuity §2.4 / §4 in
  // ctf-skills-hunt-session-continuity.md). source drives the visible
  // "Community generated" badge in the design; unclaimedHandle drives the
  // @handle vanity URL for unclaimed profiles; invitedByUsername surfaces
  // attribution without joining skills_hunt_directory_profiles.
  source: DirectoryProfileSource;
  invitedByUsername: string | null;
  unclaimedHandle: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  venmoAddress?: string | null;
  moneroAddress?: string | null;
  bitcoinAddress?: string | null;
  serviceCreditsAddress?: string | null;
  // Member location. Plain names per the shared location standard (lib/geo/locations.ts):
  // country e.g. "United States", state a US state name or a free-text region, city free text.
  city?: string | null;
  state?: string | null;
  country?: string | null;
  // "Weavers of the Commons" contributor badge (Contributor Access module). Set by the read
  // ROUTES (list / profile-by-id), not by the repository, and ONLY on a claimed profile bound to
  // a real user — a community-generated (unclaimed) profile never carries the field. True means
  // the claimed member currently holds the badge (eligible and not revoked for cause). The UI is
  // positive-only: false/absent renders nothing (no empty slot, no "not yet earned" state).
  hasWeaversBadge?: boolean;
};

export type DirectoryAnnouncement = {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
  publishedAtIso: string;
  expiresAtIso: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type DirectoryPagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type DirectoryProfileInput = {
  firstName: string;
  lastName?: string | null;
  headline?: string | null;
  bio?: string | null;
  profileUrl?: string | null;
  sectorId?: string | null;
  jobTitleId?: string | null;
  skillIds?: string[];
  // Free-text "skill not listed" labels on the profile (see DirectoryProfile.proposedSkills). Sent by
  // the member's own edit form and by the Directory admin drawer; an absent field preserves what is
  // stored rather than clearing it.
  proposedSkills?: string[];
  venmoAddress?: string | null;
  moneroAddress?: string | null;
  bitcoinAddress?: string | null;
  serviceCreditsAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export type DirectoryAnnouncementInput = {
  title: string;
  body: string;
  isActive?: boolean;
  publishedAtIso?: string | null;
  expiresAtIso?: string | null;
};

// A row from directory_suppressed_quora_urls — a Quora URL taken down at the person's request. An
// entry with isOverridden = false is an ACTIVE block: that URL cannot be listed in the directory
// again until an admin lifts it (override), which stamps the override* fields.
export type DirectorySuppressedUrl = {
  id: string;
  normalizedUrl: string;
  originalUrl: string;
  reason: string;
  removedProfileId: string | null;
  createdByUserId: string;
  createdAtIso: string;
  isOverridden: boolean;
  overriddenByUserId: string | null;
  overriddenAtIso: string | null;
  overrideReason: string | null;
};
