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
  isActive: boolean;
  // Skills Hunt + Clerk username co-change (continuity §2.4 / §4 in
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
