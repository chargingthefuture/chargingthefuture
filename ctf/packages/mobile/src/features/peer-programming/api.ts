// API client for Peer Programming plugin (mobile)

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

export type PeerProgrammingTopic = {
  id: string;
  weekStartDate: string;
  title: string;
  guidance: string;
  status: string;
};

export type PeerProgrammingCohort = {
  id: string;
  weekStartDate: string;
  cohortLabel: string;
  fallbackOpen: boolean;
  topicId: string | null;
};

export type PeerProgrammingMessage = {
  id: string;
  cohortId: string;
  authorUserId: string;
  body: string;
  tier: string;
  createdAtIso: string;
};

export type RoomData = {
  topic: PeerProgrammingTopic | null;
  cohort: PeerProgrammingCohort | null;
  messages: PeerProgrammingMessage[];
  fallbackOpen: boolean;
};

export async function fetchRoom(): Promise<RoomData> {
  const res = await fetch(`${API_BASE}/api/peer-programming/room`);
  if (!res.ok) throw new Error('Failed to load peer programming room');
  const data = await res.json();
  return {
    topic: data.topic ?? null,
    cohort: data.cohort ?? null,
    messages: data.messages ?? [],
    fallbackOpen: data.fallbackOpen ?? true,
  };
}

export async function postMessage(cohortId: string, body: string): Promise<PeerProgrammingMessage> {
  const res = await fetch(`${API_BASE}/api/peer-programming/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ cohortId, body }),
  });
  if (!res.ok) throw new Error('Failed to post message');
  const data = await res.json();
  return data.message;
}

export async function submitFeedback(cohortId: string | null, note: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/peer-programming/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({
      cohortId,
      issueType: 'general',
      suggestionCategory: 'experience',
      releaseSurface: 'android',
      note,
    }),
  });
  if (!res.ok) throw new Error('Failed to submit feedback');
}
