export type SkillsHuntRoundStatus = 'draft' | 'active' | 'closed' | 'archived';
export type SkillsHuntSubmissionStatus = 'pending' | 'accepted' | 'rejected' | 'flagged';
export type SkillsHuntReviewAction = 'accept' | 'reject' | 'edit' | 'flag';

export type SkillsHuntPagination = {
  page: number;
  pageSize: number;
};

export type SkillsHuntRound = {
  id: string;
  name: string;
  description: string | null;
  status: SkillsHuntRoundStatus;
  startsAtIso: string;
  endsAtIso: string;
  scoringConfig: Record<string, unknown>;
  // Whole ServiceCredits minted to the scout when a nomination is accepted (0 = no reward).
  rewardCreditsPerAccept: number;
  // Optional ceiling on total reward credits one scout can earn in this round (null = no cap).
  rewardPerUserRoundCap: number | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type SkillsHuntRoundInput = {
  name: string;
  description: string | null;
  status: SkillsHuntRoundStatus;
  startsAtIso: string;
  endsAtIso: string;
  scoringConfig?: Record<string, unknown>;
  rewardCreditsPerAccept?: number;
  rewardPerUserRoundCap?: number | null;
};

export type SkillsHuntUrlValidationResult = 'valid' | 'invalid' | 'dead';

export type SkillsHuntSubmissionEditEntry = {
  editedAtIso: string;
  editedByUserId: string;
  fields: Record<string, { from: unknown; to: unknown }>;
  notes?: string | null;
};

export type SkillsHuntSubmission = {
  id: string;
  roundId: string;
  submitterUserId: string;
  submitterUsername: string | null;
  fullName: string;
  bio: string;
  quoraProfileUrl: string;
  skills: string[];
  proposedSkills: string[];
  claimedProfessions: string[];
  status: SkillsHuntSubmissionStatus;
  pointsAwarded: number;
  participationPoints: number;
  creditGranted: boolean;
  creditAmount: number;
  creditGrantedAtIso: string | null;
  urlValidationResult: SkillsHuntUrlValidationResult | null;
  urlValidationCheckedAtIso: string | null;
  scoreBreakdown: Record<string, unknown>;
  reviewAction: SkillsHuntReviewAction | null;
  reviewNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAtIso: string | null;
  editHistory: SkillsHuntSubmissionEditEntry[];
  editedAtIso: string | null;
  deletedAtIso: string | null;
  directoryProfileGeneratedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type SkillsHuntSubmissionInput = {
  roundId: string;
  fullName: string;
  bio: string;
  quoraProfileUrl: string;
  skills: string[];
  proposedSkills?: string[];
  claimedProfessions: string[];
  // Nominee location. `country` is required (validated); `state`/`city` are optional. Plain names per
  // the shared location standard; carried into the generated directory profile on accept.
  country: string;
  state?: string | null;
  city?: string | null;
};

export type SkillsHuntSubmissionReviewInput = {
  action: SkillsHuntReviewAction;
  notes: string | null;
};

export type SkillsHuntLeaderboardItem = {
  rank: number;
  score: number;
  acceptedCount: number;
  firstMatchCount: number;
  pendingPoints: number;
  rareSkillBonus: number;
  userId: string | null;
  usernameSnapshot: string | null;
  lastSubmissionAtIso: string | null;
  metadata: Record<string, unknown>;
};

export type SkillsHuntLeaderboardResponse = {
  mode: 'individual';
  roundId: string;
  items: SkillsHuntLeaderboardItem[];
  totalCount: number;
  currentUserEntry: SkillsHuntLeaderboardItem | null;
  rebuiltAtIso: string;
};

export type SkillsHuntAchievementCode =
  | 'first-finder'
  | 'diversity-champion'
  | 'rare-talent-scout'
  | 'quality-contributor'
  | 'leaderboard-champion'
  // Legacy generic achievements (pre-Wave 2). Will be migrated to the 5 named
  // badges above when the scoring rewrite ships.
  | 'accepted-first'
  | 'accepted-five'
  | 'accepted-ten';

export type SkillsHuntAchievement = {
  id: string;
  userId: string;
  code: SkillsHuntAchievementCode | string;
  title: string;
  description: string;
  roundId: string | null;
  metadata: Record<string, unknown>;
  archivedAtIso: string | null;
  awardedAtIso: string;
};

export type SkillsHuntNotification = {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  readAtIso: string | null;
  createdAtIso: string;
};

export type SkillsHuntFeatureRewardCard = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
  updatedByUserId: string;
  updatedAtIso: string;
};

export type SkillsHuntFeatureRewardCardInput = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
};

export type SkillsHuntGeneratedDirectoryProfile = {
  submissionId: string;
  generatedProfileId: string;
  profileStatus: 'unclaimed';
  invitedByUsername: string;
  unclaimedHandle: string | null;
  source: 'community-generated';
  createdAtIso: string;
};

// Moderation report — backs `skills_hunt_submission_reports` and the
// community-driven "this profile was added without permission" flow.
export type SkillsHuntSubmissionReportReason =
  | 'no_permission'
  | 'inaccurate'
  | 'duplicate'
  | 'spam'
  | 'other';

export type SkillsHuntSubmissionReportStatus =
  | 'open'
  | 'dismissed'
  | 'archived'
  | 'removed';

export type SkillsHuntSubmissionReport = {
  id: string;
  submissionId: string | null;
  directoryProfileId: string | null;
  reporterUserId: string;
  reporterUsername: string | null;
  reason: SkillsHuntSubmissionReportReason;
  details: string | null;
  status: SkillsHuntSubmissionReportStatus;
  resolutionNotes: string | null;
  resolvedByUserId: string | null;
  resolvedAtIso: string | null;
  createdAtIso: string;
};

// At-least-one-target requirement is enforced at the type level via a
// discriminated union: callers must provide submissionId OR directoryProfileId.
// Passing { reason } alone is now a compile-time error.
export type SkillsHuntSubmissionReportInput =
  | {
      submissionId: string;
      directoryProfileId?: string | null;
      reason: SkillsHuntSubmissionReportReason;
      details?: string | null;
    }
  | {
      submissionId?: string | null;
      directoryProfileId: string;
      reason: SkillsHuntSubmissionReportReason;
      details?: string | null;
    };

// Reputation tier computed on demand from accepted/rejected submission counts.
export type SkillsHuntReputationTier = 'new' | 'standard' | 'trusted' | 'restricted';

export type SkillsHuntReputationProfile = {
  userId: string;
  tier: SkillsHuntReputationTier;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  rolling7dCount: number;
  rolling7dLimit: number;
  acceptanceRate: number | null;
  preApprovalRequired: boolean;
};

// Missions — themed sub-goals within a round (continuity 2.9).
// goal_metadata shape varies by goalType:
//   count_total_accepted     -> {} (no extra config)
//   count_skills_in_sector   -> { sectorId: string, sectorName: string }
//   count_rare_skill_finds   -> {} (uses round's rare_skills_lookup)
//   count_distinct_sectors   -> {} (target = number of distinct sectors required)
export type SkillsHuntMissionGoalType =
  | 'count_total_accepted'
  | 'count_skills_in_sector'
  | 'count_rare_skill_finds'
  | 'count_distinct_sectors';

// No draft state (owner directive 2026-08-27): missions are created active and the only
// lifecycle action on the admin surface is Archive. The round they belong to already carries
// its own draft/active lifecycle. 'locked' is retained for existing rows — it renders a mission
// grayed-out for members; there is still no locking-condition logic behind it.
export type SkillsHuntMissionStatus = 'active' | 'locked' | 'archived';

export type SkillsHuntMission = {
  id: string;
  roundId: string;
  title: string;
  description: string | null;
  goalType: SkillsHuntMissionGoalType;
  goalTarget: number;
  goalMetadata: Record<string, unknown>;
  bonusPoints: number;
  colorHex: string | null;
  status: SkillsHuntMissionStatus;
  displayOrder: number;
  // Auto-opened missions (Workforce sector gaps): TRUE when the generator opened this mission.
  // sourceSector / sourceGapAtCreation record which sector gap opened it and how large the gap
  // was at that moment; both are null on admin-authored missions.
  autoCreated: boolean;
  sourceSector: string | null;
  sourceGapAtCreation: number | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type SkillsHuntMissionInput = {
  roundId: string;
  title: string;
  description?: string | null;
  goalType: SkillsHuntMissionGoalType;
  goalTarget: number;
  goalMetadata?: Record<string, unknown>;
  bonusPoints: number;
  colorHex?: string | null;
  status?: SkillsHuntMissionStatus;
  displayOrder?: number;
};

export type SkillsHuntMissionProgress = {
  id: string;
  missionId: string;
  userId: string;
  progressCount: number;
  completedAtIso: string | null;
  bonusCreditedAtIso: string | null;
  metadata: Record<string, unknown>;
  updatedAtIso: string;
};

// Composite shape returned by GET /api/skills-hunt/rounds/{roundId}/missions
// for the requesting user — the player view that the Scout/Missions tab consumes.
export type SkillsHuntMissionWithProgress = SkillsHuntMission & {
  progress: SkillsHuntMissionProgress | null;
};
