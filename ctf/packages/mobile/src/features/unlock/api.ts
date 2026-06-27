// Unlock mobile API client.
// Mirrors web routes: GET /api/unlock/status, POST /api/unlock/submission.
// No CSRF header needed — the web unlock shell does not set x-ctf-csrf.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).

import { authedFetch } from '../../auth/authedFetch';

export type UnlockReviewStatus = 'pending' | 'approved' | 'rejected' | 'spam';
export type UnlockAccessTier = 'pending_readonly' | 'locked_support_only' | 'approved_full';

export type UnlockStatus = {
  userId: string;
  accessTier: UnlockAccessTier | null;
  reviewStatus: UnlockReviewStatus | null;
  unlockWindowExpiresAt: string | null;
  reminderStage: number;
  incentiveGrantedAt: string | null;
  hasSubmission: boolean;
  // A/B experiment: true when the member is in the early-Commons treatment bucket. Mirrored from the
  // web status payload. The mobile Commons help link is a parity follow-up (see Android parity note).
  earlyCommonsAccess?: boolean;
};

export async function fetchUnlockStatus(): Promise<UnlockStatus> {
  const res = await authedFetch('/api/unlock/status', {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Unlock status unavailable.');
  const data = (await res.json()) as { ok: boolean; status: UnlockStatus };
  return data.status;
}

export async function submitUnlockUrl(quoraProfileUrl: string): Promise<void> {
  const res = await authedFetch('/api/unlock/submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoraProfileUrl }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Submission failed.');
  }
}
