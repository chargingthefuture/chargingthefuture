// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

const BASE = '/api/peer-programming';

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

// How the viewer relates to the cohort whose room is open:
//   member   — placed in this cohort (can post; mobile is read-only today regardless).
//   admin    — an admin opening another cohort read-only.
//   listener — any signed-in member reading along on a running cohort they were not placed in.
export type PeerProgrammingRoomAccess = 'member' | 'admin' | 'listener';

// One running cohort for the week, used for the "listen in" list. Mirrors the web RoomCohortSummary.
export type PeerProgrammingCohortSummary = {
  id: string;
  cohortLabel: string;
  memberCount: number;
  fallbackOpen: boolean;
};

export type RoomData = {
  ok: boolean;
  topic: PeerProgrammingTopic | null;
  cohort: PeerProgrammingCohort | null;
  messages: PeerProgrammingMessage[];
  fallbackOpen: boolean;
  // The full set of running cohorts this week (for the "listen in" list).
  cohorts: PeerProgrammingCohortSummary[];
  // The viewer's own cohort id, or null when they were not placed in one.
  myCohortId: string | null;
  // The viewer's access to the open cohort's room.
  access: PeerProgrammingRoomAccess;
  isMember: boolean;
};

// Open the room. With no `cohortId`, the viewer sees their own cohort. With a `cohortId`, an admin
// or any signed-in member opens that cohort read-only ("listen in").
export async function fetchRoom(cohortId?: string | null): Promise<RoomData> {
  const url = cohortId ? `${BASE}/room?cohortId=${encodeURIComponent(cohortId)}` : `${BASE}/room`;
  const res = await authedFetch(url);
  if (!res.ok) {
    throw new Error(`room_fetch_failed:${res.status}`);
  }
  const data = (await res.json()) as RoomData;
  // Defensive defaults for the newer fields so older responses never crash the screen.
  return {
    ...data,
    cohorts: data.cohorts ?? [],
    myCohortId: data.myCohortId ?? null,
    access: data.access ?? (data.cohort ? 'member' : 'listener'),
    isMember: data.isMember ?? false,
  };
}

export async function postMessage(
  cohortId: string,
  body: string,
  tier: PeerProgrammingTier = 'cohort_member',
): Promise<PeerProgrammingMessage> {
  const res = await authedFetch(`${BASE}/messages`, {
    method: 'POST',
    headers: {
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
