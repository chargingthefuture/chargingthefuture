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
  venmoAddress?: string | null;
  moneroAddress?: string | null;
  bitcoinAddress?: string | null;
  serviceCreditsAddress?: string | null;
};

export type DirectoryAnnouncementInput = {
  title: string;
  body: string;
  isActive?: boolean;
  publishedAtIso?: string | null;
  expiresAtIso?: string | null;
};
