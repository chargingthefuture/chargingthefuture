// Mood plugin API client — binds to real backend routes.
// GET  /api/mood/eligibility?clientId=   → EligibilityResponse
// POST /api/mood/submissions             → SubmitResponse

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

export type EligibilityResponse = {
  ok: boolean;
  eligible: boolean;
  cooldownUntilIso: string | null;
  lastSubmissionAtIso: string | null;
};

export type SubmitResponse = {
  ok: boolean;
  submission: {
    id: string;
    submittedAtIso: string;
  };
};

export async function fetchMoodEligibility(clientId: string): Promise<EligibilityResponse> {
  const url = `${API_BASE}/api/mood/eligibility?clientId=${encodeURIComponent(clientId)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`eligibility_fetch_failed:${res.status}`);
  }
  return res.json() as Promise<EligibilityResponse>;
}

export async function submitMood(
  clientId: string,
  moodValue: number,
  note: string | null,
): Promise<SubmitResponse> {
  const url = `${API_BASE}/api/mood/submissions`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
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
