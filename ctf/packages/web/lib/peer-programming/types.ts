export type PeerProgrammingTier = 'cohort_member' | 'authenticated_audience' | 'unauthenticated_audience';

export type PeerProgrammingTopic = {
  id: string;
  weekStartDate: string;
  title: string;
  guidance: string;
  revisionNote: string | null;
  status: 'draft' | 'published';
};

export type PeerProgrammingCohort = {
  id: string;
  weekStartDate: string;
  cohortLabel: string;
  fallbackOpen: boolean;
  topicId: string | null;
  memberCount: number;
  // True for the single standing cohort used in low-population mode (PEER_PROGRAMMING_SINGLE_OPEN_COHORT).
  // It persists across weeks and is always open. False for ordinary week-scoped cohorts.
  isStanding: boolean;
  // Lifecycle: 'active' is live; 'ended' is a closed, read-only cohort (posting is rejected server-side).
  status: 'active' | 'ended';
  // When the cohort was ended (ISO), or null while active.
  endedAtIso: string | null;
};

export type PeerProgrammingMessage = {
  id: string;
  cohortId: string;
  authorUserId: string;
  parentMessageId: string | null;
  body: string;
  tier: PeerProgrammingTier;
  createdAtIso: string;
};
