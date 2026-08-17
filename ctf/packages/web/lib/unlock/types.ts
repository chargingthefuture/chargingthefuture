export type UnlockReviewStatus = 'pending' | 'approved' | 'rejected' | 'spam';

export type UnlockAccessTier = 'pending_readonly' | 'locked_support_only' | 'approved_full';

export type UnlockSubmission = {
  id: number;
  userId: string;
  quoraProfileUrl: string;
  quoraProfileUrlNormalized: string;
  reviewStatus: UnlockReviewStatus;
  accessTier: UnlockAccessTier;
  unlockWindowExpiresAt: string;
  reminderStage: number;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  incentiveGrantedAt: string | null;
  // Duplicate-identity guard. rewardWithheldAt: the reward was held because another account already
  // holds this Quora identity's reward — awaiting an admin determination. rewardRevokedAt: an admin
  // clawed the reward back (the "loser" of a determination, or a perp).
  rewardWithheldAt: string | null;
  rewardRevokedAt: string | null;
  // How many accounts (including this one) have claimed the same normalized Quora URL. Only populated
  // by the admin queue list; 1 means no duplicate. Undefined where not computed.
  sharedUrlAccountCount?: number;
  // How many times this member's Quora URL has changed (directory_quora_url_history). Only populated by
  // the admin queue list. 0/1 is normal; a higher count is a signal to open the history and review —
  // never an automatic flag (Quora sometimes deletes accounts, so re-profiling is legitimate).
  quoraUrlChangeCount?: number;
  // Who the member is, so an admin reviewing the queue is not reading a Clerk id. Only populated by
  // the admin queue list; null when the member has no directory profile / no handle on file.
  memberName?: string | null;
  memberUsername?: string | null;
  createdAt: string;
  updatedAt: string;
};

// One row of the persistent spam Quora-URL denylist (unlock_spam_quora_urls), as shown in the admin
// denylist panel. Keyed on the normalized URL; holds no member id.
export type SpamQuoraUrlEntry = {
  quoraProfileUrlNormalized: string;
  quoraProfileUrl: string;
  flaggedByUserId: string | null;
  flagCount: number;
  firstFlaggedAt: string;
  lastFlaggedAt: string;
};

export type RevokeUnlockRewardInput = {
  actorUserId: string;
  submissionId: number;
  reviewNote?: string;
};

export type CreateUnlockSubmissionInput = {
  userId: string;
  quoraProfileUrl: string;
  quoraProfileUrlNormalized: string;
};

export type ReviewUnlockSubmissionInput = {
  actorUserId: string;
  submissionId: number;
  reviewStatus: Exclude<UnlockReviewStatus, 'pending'>;
  reviewNote?: string;
};

export type UnlockQueueFilters = {
  reviewStatus?: UnlockReviewStatus;
  accessTier?: UnlockAccessTier;
  limit?: number;
};

export type UnlockDashboardSnapshot = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  spamCount: number;
  lockedSupportOnlyCount: number;
};

// One row of the "early Commons access" A/B experiment readout, per bucket.
//   bucket        — 'early_commons' (treatment) or 'control'.
//   exposed       — distinct members seen in this bucket (counted from unlock.status.get audit rows).
//   submitted     — of those, how many have a successful Quora-URL submission.
//   completionPct — submitted / exposed, as a percentage (one decimal).
export type UnlockExperimentBucketStat = {
  bucket: string;
  exposed: number;
  submitted: number;
  completionPct: number;
};

export type UnlockStatus = {
  userId: string;
  accessTier: UnlockAccessTier | null;
  reviewStatus: UnlockReviewStatus | null;
  unlockWindowExpiresAt: string | null;
  reminderStage: number;
  incentiveGrantedAt: string | null;
  hasSubmission: boolean;
  // A/B experiment: true when this member is in the "early Commons access" treatment bucket, so the
  // UI can offer a link into the Commons to ask for help before verifying. Set by the status route
  // (not the repository) from the Unleash rollout; defaults to false (control).
  earlyCommonsAccess: boolean;
};
