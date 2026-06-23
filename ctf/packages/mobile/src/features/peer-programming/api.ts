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

// A cohort member: user id + resolved display name (null when Clerk could not resolve it).
export type PeerProgrammingCohortMember = {
  userId: string;
  username: string | null;
};

export type RoomData = {
  ok: boolean;
  topic: PeerProgrammingTopic | null;
  cohort: PeerProgrammingCohort | null;
  messages: PeerProgrammingMessage[];
  fallbackOpen: boolean;
  // The full set of running cohorts this week (for the "listen in" list).
  cohorts: PeerProgrammingCohortSummary[];
  // Who is in the open cohort (resolved usernames), so members see their cohort-mates.
  members: PeerProgrammingCohortMember[];
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
    members: data.members ?? [],
    myCohortId: data.myCohortId ?? null,
    access: data.access ?? (data.cohort ? 'member' : 'listener'),
    isMember: data.isMember ?? false,
  };
}

// The credential shape returned by POST /api/peer-programming/session/join when the call is allowed.
// The same Stream token works for video; the call id is derived server-side from the caller's cohort,
// so the caller can only ever join their own cohort's call.
export type PeerProgrammingSessionCredentials = {
  cohortId: string;
  displayName: string;
  streamApiKey: string;
  streamCallId: string;
  streamUserId: string;
  streamToken: string;
};

// The three non-success outcomes the Session tab must distinguish:
//   no-cohort        — the route returned 404 (the member is not in a cohort yet).
//   stream-disabled  — the route returned 503 (GetStream is not configured server-side).
//   error            — any other failure (network, auth, unexpected status).
export type PeerProgrammingSessionJoinResult =
  | { status: 'ok'; credentials: PeerProgrammingSessionCredentials }
  | { status: 'no-cohort' }
  | { status: 'stream-disabled' }
  | { status: 'error'; message: string };

// Mint live-video credentials for the caller's cohort session. Mirrors the web Session tab's
// handleJoin: POST through authedFetch (Clerk bearer + CSRF header), then map 404 -> no-cohort,
// 503 -> stream-disabled, missing fields -> error.
export async function joinSession(): Promise<PeerProgrammingSessionJoinResult> {
  let res: Response;
  try {
    res = await authedFetch(`${BASE}/session/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
    });
  } catch {
    return { status: 'error', message: 'Could not reach the live session. Check your connection and try again.' };
  }

  if (res.status === 404) {
    return { status: 'no-cohort' };
  }
  if (res.status === 503) {
    return { status: 'stream-disabled' };
  }

  const data = (await res.json().catch(() => null)) as
    | (Partial<PeerProgrammingSessionCredentials> & { message?: string })
    | null;

  if (!res.ok || !data?.streamApiKey || !data.streamCallId || !data.streamToken || !data.streamUserId) {
    return { status: 'error', message: data?.message ?? 'Could not start the live session.' };
  }

  return {
    status: 'ok',
    credentials: {
      cohortId: data.cohortId ?? '',
      displayName: data.displayName ?? 'Member',
      streamApiKey: data.streamApiKey,
      streamCallId: data.streamCallId,
      streamUserId: data.streamUserId,
      streamToken: data.streamToken,
    },
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
