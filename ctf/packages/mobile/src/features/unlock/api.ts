// Unlock mobile API client.
// Mirrors web routes: GET /api/unlock/status, POST /api/unlock/submission.
// No CSRF header needed — the web unlock shell does not set x-ctf-csrf.

import { Platform } from 'react-native';

const API_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000';

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
};

export async function fetchUnlockStatus(): Promise<UnlockStatus> {
  const res = await fetch(`${API_BASE_URL}/api/unlock/status`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Unlock status unavailable.');
  const data = (await res.json()) as { ok: boolean; status: UnlockStatus };
  return data.status;
}

export async function submitUnlockUrl(quoraProfileUrl: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/unlock/submission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoraProfileUrl }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Submission failed.');
  }
}
