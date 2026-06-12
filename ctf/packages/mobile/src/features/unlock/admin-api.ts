import { authedFetch } from '../../auth/authedFetch';
import type { UnlockAccessTier, UnlockReviewStatus } from './api';

// Admin client for the Unlock plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/unlock/admin/*. Admin access is enforced server-side
// (requireUnlockAdminAccess); a 401/403 surfaces as a "forbidden" notice in the
// screen. Mutations carry the x-ctf-csrf confirmation header the API requires.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
const ADMIN_API_BASE = '/api/unlock/admin';

// Mirrors lib/unlock/types.ts UnlockSubmission.
export type UnlockAdminSubmission = {
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
  createdAt: string;
  updatedAt: string;
};

// The review route accepts approved | rejected | spam (never pending).
export type UnlockReviewDecision = Exclude<UnlockReviewStatus, 'pending'>;

export type SubmissionsFetchResult = {
  ok: boolean;
  forbidden: boolean;
  items: UnlockAdminSubmission[];
  message: string | null;
};

// GET the pending verification queue. Admin gated; returns forbidden:true for non-admins.
export async function fetchPendingSubmissions(): Promise<SubmissionsFetchResult> {
  const res = await authedFetch(`${ADMIN_API_BASE}/submissions?reviewStatus=pending&limit=50`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, items: [], message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, items: [], message: `Could not load submissions (${res.status}).` };
  }
  const data = (await res.json()) as { submissions?: UnlockAdminSubmission[] };
  return { ok: true, forbidden: false, items: data.submissions ?? [], message: null };
}

// POST a review decision for one submission. Carries the CSRF confirmation header.
export async function reviewSubmission(
  submissionId: number,
  reviewStatus: UnlockReviewDecision,
  reviewNote?: string,
): Promise<UnlockAdminSubmission> {
  const res = await authedFetch(`${ADMIN_API_BASE}/submissions/${submissionId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify(reviewNote ? { reviewStatus, reviewNote } : { reviewStatus }),
  });
  if (!res.ok) {
    throw new Error(`submission_review_failed:${res.status}`);
  }
  const data = (await res.json()) as { submission: UnlockAdminSubmission };
  return data.submission;
}
