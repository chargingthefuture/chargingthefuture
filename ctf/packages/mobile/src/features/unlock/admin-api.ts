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

// The status filters the mobile admin queue can show. 'all' omits the reviewStatus query param so the
// server returns every submission — including approved-but-uncredited rows that need operator attention.
export type UnlockAdminQueueFilter = 'pending' | 'approved' | 'all';

// GET the verification queue for a given status filter. Admin gated; returns forbidden:true for non-admins.
// Defaults to the pending queue. 'approved' surfaces approved submissions (whose reward may still be
// pending); 'all' returns every status, matching the web admin shell's tabs.
export async function fetchSubmissions(
  filter: UnlockAdminQueueFilter = 'pending',
): Promise<SubmissionsFetchResult> {
  const query = filter === 'all' ? 'limit=50' : `reviewStatus=${filter}&limit=50`;
  const res = await authedFetch(`${ADMIN_API_BASE}/submissions?${query}`, {
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

// Result of an on-demand reward reconcile. Mirrors the web reconcileUnlockRewards summary, including
// `withheld` (rewards held by the duplicate-identity guard) and per-submission `errors`, so the mobile
// operator summary matches what the web shell surfaces instead of silently dropping held/failed rows.
export type UnlockReconcileResult = {
  scanned: number;
  granted: number;
  alreadyGranted: number;
  withheld: number;
  failed: number;
  errors: { submissionId: number; message: string }[];
};

// POST to mint any approved-but-uncredited verification reward on demand. Admin-session gated (no
// CRON_SECRET); runs the same idempotent reconcileUnlockRewards server-side, so it can never
// double-grant. Carries the CSRF confirmation header.
export async function reconcileRewards(): Promise<UnlockReconcileResult> {
  const res = await authedFetch(`${ADMIN_API_BASE}/reconcile-rewards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`reconcile_rewards_failed:${res.status}`);
  }
  const data = (await res.json()) as Partial<UnlockReconcileResult>;
  return {
    scanned: data.scanned ?? 0,
    granted: data.granted ?? 0,
    alreadyGranted: data.alreadyGranted ?? 0,
    withheld: data.withheld ?? 0,
    failed: data.failed ?? 0,
    errors: data.errors ?? [],
  };
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
