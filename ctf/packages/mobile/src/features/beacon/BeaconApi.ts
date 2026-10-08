// Beacon API client (mobile).
//
// Beacon is a one-way livestream the community watches. Watching is public over HLS (no sign-in);
// chatting needs a signed-in member; going live needs an admin. Every call goes through authedFetch,
// which sends the Clerk token as a Bearer header — the web routes accept it — and every POST sends
// `x-ctf-csrf: 1`, which the Beacon mutation routes require (a native client sends no Origin, so the
// origin check passes).
//
// Viewer:
//   - GET  /api/beacon/current            public; the live event (or null), its HLS playback URL, and
//                                          the last replay for the idle state.
//   - POST /api/beacon/[id]/chat-token     member; a Stream Chat token for the event chat.
// Host (admin):
//   - POST /api/beacon/[id]/start-broadcast starts the public feed and recording once media exists.
// The rest of the admin routes are in BeaconAdminApi.ts.
import { authedFetch } from '../../auth/authedFetch';

// Mirrors the web viewer's BeaconEventLike shape from /api/beacon/current.
export type BeaconEventLike = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'live' | 'ended';
  recordingUrl: string | null;
};

// The JSON shape returned by GET /api/beacon/current.
export type BeaconCurrentResponse = {
  ok: boolean;
  event: BeaconEventLike | null;
  hlsPlaybackUrl: string | null;
  replay: BeaconEventLike | null;
};

// Stream Chat credentials minted by POST /api/beacon/[id]/chat-token for members.
export type BeaconChatCredentials = {
  streamApiKey: string;
  streamChannelType: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

// The host's Stream Video credentials, part of the GET /api/beacon/[id]/ingest answer.
export type BeaconHostCredentials = {
  streamApiKey: string;
  streamCallType: string;
  streamCallId: string;
  streamUserId: string;
  hostToken: string;
};

const CSRF_HEADERS = { 'x-ctf-csrf': '1' };

// Reads a JSON body and throws with the route's own message on a non-2xx answer or `ok: false`, so
// the screen can show why a step failed rather than a generic line.
async function readJson(res: Response, what: string): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`${what} answered ${res.status} with a body that is not JSON.`);
  }
  if (!res.ok || !data || data.ok !== true) {
    const message = data && typeof data.message === 'string' ? data.message : `${what} answered ${res.status}.`;
    throw new Error(message);
  }
  return data;
}

// Public endpoint — works signed-out. Throws on failure so the screen keeps its previous state on a
// poll that fails rather than blanking.
export async function getBeaconCurrent(): Promise<BeaconCurrentResponse> {
  const data = await readJson(await authedFetch('/api/beacon/current', { method: 'GET' }), 'The live event lookup');
  return {
    ok: true,
    event: (data.event as BeaconEventLike | null) ?? null,
    hlsPlaybackUrl: (data.hlsPlaybackUrl as string | null) ?? null,
    replay: (data.replay as BeaconEventLike | null) ?? null,
  };
}

// Signed-in member only. Returns null when chat is not configured (503) or the member gate denies
// (401); the caller shows a calm "chat unavailable" line.
export async function getBeaconChatCredentials(eventId: string): Promise<BeaconChatCredentials | null> {
  const res = await authedFetch(`/api/beacon/${eventId}/chat-token`, { method: 'POST', headers: CSRF_HEADERS });
  try {
    const data = await readJson(res, 'The chat sign-in');
    return {
      streamApiKey: data.streamApiKey as string,
      streamChannelType: data.streamChannelType as string,
      streamChannelId: data.streamChannelId as string,
      streamUserId: data.streamUserId as string,
      streamToken: data.streamToken as string,
    };
  } catch {
    return null;
  }
}

async function postBeacon(eventId: string, step: string, what: string): Promise<void> {
  await readJson(await authedFetch(`/api/beacon/${eventId}/${step}`, { method: 'POST', headers: CSRF_HEADERS }), what);
}

export const startBeaconBroadcast = (eventId: string) =>
  postBeacon(eventId, 'start-broadcast', 'Starting the public broadcast and recording');
