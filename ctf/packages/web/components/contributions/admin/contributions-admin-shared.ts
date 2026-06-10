// Shared types, API helpers, and the credit-valuation mapping for the Contributions admin console.

import type {
  ContributionStatus,
  ContributionSubmissionAdminView,
  ContributionsCycle,
  ContributionsRuntimeConfig,
} from '@/lib/contributions/types';

export type AdminTab = 'queue' | 'drive' | 'settings';
export type QueueFilter = 'all' | 'pending' | 'confirmed' | 'rejected';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

export type AdminError = { message: string };

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? 'Something went wrong. Try again in a moment.';
}

export async function fetchSubmissions(filter: QueueFilter): Promise<ContributionSubmissionAdminView[]> {
  const query = filter === 'all' ? '' : `?status=${filter}`;
  const res = await fetch(`/api/contributions/admin/submissions${query}`, { cache: 'no-store' });
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
  const res = await fetch(`/api/contributions/admin/submissions/${submissionId}/review`, {
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

export async function fetchConfig(): Promise<ContributionsRuntimeConfig> {
  const res = await fetch('/api/contributions/admin/config', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { config: ContributionsRuntimeConfig };
  return data.config;
}

export async function updateConfig(body: Partial<{
  creditsPerUsd: number;
  nonMonetaryUnitValueUsd: number;
  perUserCycleCreditCap: number;
  bannerEnabled: boolean;
  signalInstructions: string;
}>): Promise<ContributionsRuntimeConfig> {
  const res = await fetch('/api/contributions/admin/config', {
    method: 'PUT',
    headers: CSRF_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { config: ContributionsRuntimeConfig };
  return data.config;
}

export async function fetchCycles(): Promise<ContributionsCycle[]> {
  const res = await fetch('/api/contributions/admin/cycles', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { cycles: ContributionsCycle[] };
  return data.cycles ?? [];
}

export async function createCycle(body: {
  startsAt: string;
  endsAt: string;
  fiatGoalUsd: number;
  quoraCommentGoal: number;
  githubStarGoal: number;
}): Promise<ContributionsCycle> {
  const res = await fetch('/api/contributions/admin/cycles', {
    method: 'POST',
    headers: CSRF_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { cycle: ContributionsCycle };
  return data.cycle;
}

export async function updateCycle(
  cycleId: string,
  body: Partial<{ startsAt: string; endsAt: string; fiatGoalUsd: number; quoraCommentGoal: number; githubStarGoal: number }>,
): Promise<ContributionsCycle> {
  const res = await fetch(`/api/contributions/admin/cycles/${cycleId}`, {
    method: 'PUT',
    headers: CSRF_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { cycle: ContributionsCycle };
  return data.cycle;
}

// --- credit valuation mapping ------------------------------------------------------------------
//
// The stored model is authoritative: a confirmed comment or star is worth
// `non_monetary_unit_value_usd` USD, and credits = USD-equivalent x `credits_per_usd`. The admin
// mockup exposes a single "Credits per comment or star" number (resulting SC). We surface that
// resulting-SC value and convert it back to the stored USD-equivalent before saving, so the stored
// model stays the source of truth.

export function creditsPerActionFromConfig(config: ContributionsRuntimeConfig): number {
  return Math.round(config.nonMonetaryUnitValueUsd * config.creditsPerUsd);
}

// Convert a resulting-SC-per-action value back to the stored USD-equivalent, given creditsPerUsd.
export function nonMonetaryUnitValueFromCreditsPerAction(creditsPerAction: number, creditsPerUsd: number): number {
  if (creditsPerUsd <= 0) {
    return creditsPerAction;
  }
  return creditsPerAction / creditsPerUsd;
}

export type { ContributionStatus, ContributionSubmissionAdminView, ContributionsCycle, ContributionsRuntimeConfig };
