// Shared types and API helpers for the Contributions admin dashboard.

import type {
  ContributionStatus,
  ContributionSubmissionAdminView,
  ContributionsRuntimeConfig,
} from '@/lib/contributions/types';

export type AdminTab = 'queue' | 'settings';
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

export async function updateConfig(body: Partial<{ creditsPerUsd: number; perUserYearCreditCap: number }>): Promise<ContributionsRuntimeConfig> {
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

// One claim's code, read when the admin is about to redeem it. Audited on the server, never cached.
export async function revealCode(submissionId: string): Promise<string> {
  const res = await fetch(`/api/contributions/admin/submissions/${submissionId}/code`, { method: 'POST', headers: CSRF_HEADERS });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { code: string };
  return data.code;
}

export type { ContributionStatus, ContributionSubmissionAdminView, ContributionsRuntimeConfig };
