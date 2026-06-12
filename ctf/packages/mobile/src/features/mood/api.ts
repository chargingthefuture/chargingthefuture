// Mood plugin API client — binds to real backend routes.
// GET  /api/mood/eligibility?clientId=   → EligibilityResponse
// POST /api/mood/submissions             → SubmitResponse
// GET  /api/mood/community               → CommunityResponse (aggregate only)
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).

import { authedFetch } from '../../auth/authedFetch';

export type EligibilityResponse = {
  ok: boolean;
  eligible: boolean;
  cooldownUntilIso: string | null;
  lastSubmissionAtIso: string | null;
};

export type CommunityPulseDay = {
  dateIso: string;
  averageMood: number | null;
  count: number;
};

export type CommunityPulse = {
  windowDays: number;
  minSample: number;
  totalCount: number;
  averageMood: number | null;
  hasEnoughData: boolean;
  days: CommunityPulseDay[];
};

export type CommunityResponse = {
  ok: boolean;
  pulse: CommunityPulse;
};

export type SubmitResponse = {
  ok: boolean;
  submission: {
    id: string;
    submittedAtIso: string;
  };
};

export async function fetchMoodEligibility(clientId: string): Promise<EligibilityResponse> {
  const res = await authedFetch(`/api/mood/eligibility?clientId=${encodeURIComponent(clientId)}`);
  if (!res.ok) {
    throw new Error(`eligibility_fetch_failed:${res.status}`);
  }
  return res.json() as Promise<EligibilityResponse>;
}

export async function fetchMoodCommunity(): Promise<CommunityResponse> {
  const res = await authedFetch('/api/mood/community');
  if (!res.ok) {
    throw new Error(`community_fetch_failed:${res.status}`);
  }
  const data = (await res.json()) as Partial<CommunityResponse>;
  if (data?.ok !== true || !data.pulse) {
    throw new Error('community_fetch_invalid_payload');
  }
  return data as CommunityResponse;
}

export async function submitMood(
  clientId: string,
  moodValue: number,
  note: string | null,
): Promise<SubmitResponse> {
  const res = await authedFetch('/api/mood/submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ clientId, moodValue, note }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    throw new Error(body.code ?? `submit_failed:${res.status}`);
  }
  return res.json() as Promise<SubmitResponse>;
}
