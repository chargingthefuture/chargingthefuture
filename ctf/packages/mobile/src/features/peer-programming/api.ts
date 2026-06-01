import { Platform } from 'react-native';

const API_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/peer-programming'
    : 'http://localhost:3000/api/peer-programming';

export type PeerProgrammingTier = 'cohort_member' | 'authenticated_audience' | 'public_audience';

export type PeerProgrammingTopic = {
  id: string;
  weekStartDate: string;
  title: string;
  guidance: string;
  revisionNote: string | null;
  status: 'draft' | 'published';
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
  parentMessageId: string | null;
  body: string;
  tier: PeerProgrammingTier;
  createdAtIso: string;
};

export type RoomData = {
  ok: boolean;
  topic: PeerProgrammingTopic | null;
  cohort: PeerProgrammingCohort | null;
  messages: PeerProgrammingMessage[];
  fallbackOpen: boolean;
};

export async function fetchRoom(authToken: string): Promise<RoomData> {
  const res = await fetch(`${API_BASE_URL}/room`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`room_fetch_failed:${res.status}`);
  }
  return res.json() as Promise<RoomData>;
}

export async function postMessage(
  authToken: string,
  cohortId: string,
  body: string,
  tier: PeerProgrammingTier = 'cohort_member',
): Promise<PeerProgrammingMessage> {
  const res = await fetch(`${API_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ cohortId, body, tier }),
  });
  if (!res.ok) {
    throw new Error(`message_post_failed:${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; message: PeerProgrammingMessage };
  return data.message;
}
