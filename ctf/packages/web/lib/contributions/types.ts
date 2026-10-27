// 'quora_comment' and 'github_star' remain only on claims made before 2026-10-27; new claims are gift cards.
export type ContributionKind = 'gift_card' | 'quora_comment' | 'github_star';

export type ContributionStatus = 'pending' | 'confirmed' | 'rejected';

export type ContributionSubmission = {
  id: string;
  userId: string;
  kind: ContributionKind;
  method: string | null;
  claimedAmountUsd: number | null;
  status: ContributionStatus;
  confirmedAmountUsd: number | null;
  creditsGranted: number;
  creditGovernanceEventId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

// Admin-only projection. hasCode says whether a code is still stored (it is erased on review); the
// code itself is read one claim at a time through the audited reveal route, never in a list.
export type ContributionSubmissionAdminView = ContributionSubmission & {
  hasCode: boolean;
};

export type CreateContributionSubmissionInput = {
  userId: string;
  claimedAmountUsd: number;
  code: string;
};

export type ReviewContributionSubmissionInput = {
  actorUserId: string;
  submissionId: string;
  action: 'confirm' | 'reject';
  confirmedAmountUsd?: number;
  reviewNote?: string;
};

export type ContributionsRuntimeConfig = {
  creditsPerUsd: number;
  perUserYearCreditCap: number;
  updatedByUserId: string | null;
  updatedAt: string | null;
};

export type UpdateContributionsConfigInput = {
  actorUserId: string;
  creditsPerUsd?: number;
  perUserYearCreditCap?: number;
};

export type ContributionsQueueFilters = {
  status?: ContributionStatus;
  limit?: number;
};
