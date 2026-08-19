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

export type UnlockStatus = {
  userId: string;
  accessTier: UnlockAccessTier | null;
  reviewStatus: UnlockReviewStatus | null;
  unlockWindowExpiresAt: string | null;
  reminderStage: number;
  incentiveGrantedAt: string | null;
  hasSubmission: boolean;
  // True when this member may enter the Commons even though they have no submission on file —
  // because they asked for help, or because they have been here on an earlier day. Set by the status
  // route (not the repository), which keeps `accessTier` meaning strictly "what the submission says".
  // The mobile app reads this to decide whether to show the Unlock wall or the app shell.
  commonsAccess: boolean;
};

// One account on the Unlock admin's demo/test exclusion list (unlock_excluded_accounts). Marking an
// account here takes it out of every sign-up number on that page; it changes nothing about the member's
// access or their submission.
export type UnlockExcludedAccount = {
  userId: string;
  note: string | null;
  excludedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

// One signed-up account as the Unlock admin's sign-up panel shows it: who they are, when they joined,
// and whether they ever gave us a Quora URL. Identity comes from the auth provider (an account that
// never submitted has no row of ours to read a name from); the submission fields come from
// unlock_verification_submissions.
export type UnlockSignupAccount = {
  userId: string;
  name: string | null;
  username: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  // True when an admin has marked this as a demo/test account, so the sign-up counters leave it out.
  excluded: boolean;
  excludedNote: string | null;
  // True when this account has an account-scope row in account_deletion_events: the person asked to be
  // forgotten and their data is gone. Their submission row went with it, so without this they would be
  // counted as "signed up, never gave a Quora URL" — the opposite of what happened.
  deletedTheirData: boolean;
  deletedAt: string | null;
  hasSubmission: boolean;
  reviewStatus: UnlockReviewStatus | null;
  submittedAt: string | null;
};

// The sign-up reading on the Unlock admin page. `available: false` means the roster could not be read
// (the auth provider is not configured in this runtime, or the call failed) and `unavailableReason` says
// why in plain words; every count is 0 in that case rather than pretending nobody signed up.
export type UnlockSignupOverview = {
  available: boolean;
  unavailableReason: string | null;
  // True when the roster hit the per-load account cap, so the counts cover only the accounts read.
  truncated: boolean;
  // Every account the auth provider holds, demo/test accounts included.
  totalAccounts: number;
  // How many of those an admin has marked demo/test.
  excludedCount: number;
  // How many of the rest deleted their data (an account-scope row in account_deletion_events).
  deletedCount: number;
  // totalAccounts - excludedCount - deletedCount: the people we treat as real sign-ups.
  memberCount: number;
  // Of memberCount, how many have a Quora URL on file, in any review state.
  submittedCount: number;
  // memberCount - submittedCount: signed up, never submitted a Quora URL.
  notSubmittedCount: number;
  accounts: UnlockSignupAccount[];
};
