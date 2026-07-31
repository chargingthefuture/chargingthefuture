export type ContributionKind = 'gift_card' | 'quora_comment' | 'github_star';

export type GiftCardMethod = 'amazon' | 'apple' | 'dennys';

export type ContributionStatus = 'pending' | 'confirmed' | 'rejected';

export type ContributionSubmission = {
  id: string;
  userId: string;
  kind: ContributionKind;
  method: GiftCardMethod | null;
  claimedAmountUsd: number | null;
  quoraPostUrl: string | null;
  githubProfileUrl: string | null;
  status: ContributionStatus;
  confirmedAmountUsd: number | null;
  creditsGranted: number;
  creditGovernanceEventId: string | null;
  cycleId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

// Admin-only projection: includes the member's Signal contact (personal data) so the owner
// can match a gift-card code received over Signal to the claim. Never logged or audited.
export type ContributionSubmissionAdminView = ContributionSubmission & {
  signalContact: string | null;
};

export type CreateContributionSubmissionInput = {
  userId: string;
  kind: ContributionKind;
  method?: GiftCardMethod;
  claimedAmountUsd?: number;
  signalContact?: string;
  quoraPostUrl?: string;
  githubProfileUrl?: string;
};

export type ReviewContributionSubmissionInput = {
  actorUserId: string;
  submissionId: string;
  action: 'confirm' | 'reject';
  confirmedAmountUsd?: number;
  reviewNote?: string;
};

export type ContributionsCycle = {
  id: string;
  startsAt: string;
  endsAt: string;
  fiatGoalUsd: number;
  quoraCommentGoal: number;
  githubStarGoal: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateContributionsCycleInput = {
  actorUserId: string;
  startsAt: string;
  endsAt: string;
  fiatGoalUsd: number;
  quoraCommentGoal: number;
  githubStarGoal: number;
};

export type UpdateContributionsCycleInput = {
  actorUserId: string;
  cycleId: string;
  startsAt?: string;
  endsAt?: string;
  fiatGoalUsd?: number;
  quoraCommentGoal?: number;
  githubStarGoal?: number;
};

export type ContributionsRuntimeConfig = {
  creditsPerUsd: number;
  nonMonetaryUnitValueUsd: number;
  perUserCycleCreditCap: number;
  bannerSnoozeMonths: number;
  bannerEnabled: boolean;
  signalInstructions: string;
  updatedByUserId: string | null;
  updatedAt: string | null;
};

export type UpdateContributionsConfigInput = {
  actorUserId: string;
  creditsPerUsd?: number;
  nonMonetaryUnitValueUsd?: number;
  perUserCycleCreditCap?: number;
  bannerSnoozeMonths?: number;
  bannerEnabled?: boolean;
  signalInstructions?: string;
};

export type FundraiserSnapshot = {
  cycle: ContributionsCycle | null;
  fiatConfirmedUsd: number;
  quoraCommentsConfirmed: number;
  githubStarsConfirmed: number;
  contributorCount: number;
  bannerVisible: boolean;
  // Whether the fundraiser banner feature is on at all (admin toggle), independent of the per-member
  // snooze that drives bannerVisible. Lets the phone-width UI tell "snoozed" (show the emoji reminder)
  // from "turned off" (show nothing).
  bannerEnabled: boolean;
  // True when this member already holds a confirmed, credit-earning github_star contribution.
  // The github-star path is then a once-per-member-ever lifetime grant, so the UI grays it out.
  githubStarAlreadyCredited: boolean;
};

export type ContributionsQueueFilters = {
  status?: ContributionStatus;
  limit?: number;
};
