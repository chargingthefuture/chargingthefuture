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
  // True when this member may enter the Commons even though they have no submission on file —
  // because they asked for help, or because they have been here on an earlier day. Mirrored from the
  // web status payload. Drives the client Unlock gate and the Commons verify prompt.
  commonsAccess?: boolean;
};

export async function fetchUnlockStatus(): Promise<UnlockStatus> {
  const res = await authedFetch('/api/unlock/status', {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Unlock status unavailable.');
  const data = (await res.json()) as { ok: boolean; status: UnlockStatus };
  return data.status;
}

// "I can't do this step — let me ask somebody." Records the request, which is what opens the Commons
// to a member with no submission, so there is somebody to ask. The caller refreshes the Unlock gate
// afterwards, which is what actually moves them into the app shell.
export async function requestUnlockHelp(): Promise<void> {
  const res = await authedFetch('/api/unlock/help-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  if (!res.ok) throw new Error('Could not open the Commons just now.');
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
