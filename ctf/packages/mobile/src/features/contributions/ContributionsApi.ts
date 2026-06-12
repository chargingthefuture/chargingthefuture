// Contributions mobile API client.
// Mirrors the web routes under /api/contributions/*. Mutations send the x-ctf-csrf header that
// the web shells set (the server requires it on every mutation). All calls go through authedFetch
// so the Clerk bearer token is attached and the base URL comes from runtime config (APP_URL).

import { authedFetch } from '../../auth/authedFetch';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

export type ContributionKind = 'gift_card' | 'quora_comment' | 'github_star';
export type GiftCardMethod = 'amazon' | 'apple' | 'dennys';
export type ContributionStatus = 'pending' | 'confirmed' | 'rejected';

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

export type ContributionSubmissionAdminView = ContributionSubmission & { signalContact: string | null };

export type FundraiserSnapshot = {
  cycle: ContributionsCycle | null;
  fiatConfirmedUsd: number;
  quoraCommentsConfirmed: number;
  githubStarsConfirmed: number;
  contributorCount: number;
  bannerVisible: boolean;
  githubStarAlreadyCredited: boolean;
};

export type FundraiserResponse = {
  ok: boolean;
  fundraiser: FundraiserSnapshot;
  signalInstructions: string;
  ownerSignalUrl: string | null;
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

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? 'Something went wrong. Try again in a moment.';
}

// --- member ------------------------------------------------------------------------------------

export async function fetchFundraiser(): Promise<FundraiserResponse> {
  const res = await authedFetch('/api/contributions/fundraiser', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as FundraiserResponse;
}

export async function fetchOwnSubmissions(): Promise<ContributionSubmission[]> {
  const res = await authedFetch('/api/contributions/submission', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { submissions: ContributionSubmission[] };
  return data.submissions ?? [];
}

export type CreateSubmissionInput =
  | { kind: 'gift_card'; method: GiftCardMethod; claimedAmountUsd: number; signalContact: string }
  | { kind: 'quora_comment'; quoraPostUrl?: string }
  | { kind: 'github_star'; githubProfileUrl?: string };

export async function createSubmission(input: CreateSubmissionInput): Promise<ContributionSubmission> {
  const res = await authedFetch('/api/contributions/submission', {
    method: 'POST',
    headers: CSRF_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { submission: ContributionSubmission };
  return data.submission;
}

export async function dismissBanner(): Promise<void> {
  await authedFetch('/api/contributions/banner/dismiss', { method: 'POST', headers: CSRF_HEADERS }).catch(() => undefined);
}

// --- admin -------------------------------------------------------------------------------------

export async function fetchAdminSubmissions(status?: ContributionStatus): Promise<ContributionSubmissionAdminView[]> {
  const query = status ? `?status=${status}` : '';
  const res = await authedFetch(`/api/contributions/admin/submissions${query}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { submissions: ContributionSubmissionAdminView[] };
  return data.submissions ?? [];
}

export async function reviewSubmission(
  submissionId: string,
  body: { action: 'confirm' | 'reject'; confirmedAmountUsd?: number; reviewNote?: string },
): Promise<ContributionSubmissionAdminView> {
  const res = await authedFetch(`/api/contributions/admin/submissions/${submissionId}/review`, {
    method: 'POST',
    headers: CSRF_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { submission: ContributionSubmissionAdminView };
  return data.submission;
}

export async function fetchAdminConfig(): Promise<ContributionsRuntimeConfig> {
  const res = await authedFetch('/api/contributions/admin/config', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { config: ContributionsRuntimeConfig };
  return data.config;
}
