// Beacon viewer API client (mobile).
//
// Beacon is an admin one-way livestream the community watches. Watching is public
// over HLS (no sign-in); chatting/reacting requires a signed-in member. This client
// mirrors the two viewer-facing web routes:
//   - GET  /api/beacon/current        public; the live event (or null) + the HLS
//                                      playback URL + the last replay for the idle state.
//   - POST /api/beacon/[id]/chat-token signed-in member only; mints a Stream Chat
//                                      token for the live event chat. Anonymous callers
//                                      get 401 from the member gate and can only watch.
//
// Admin broadcasting (create/go-live/end/moderate) is intentionally NOT here: on
// mobile the admin broadcasts the phone screen through a third-party RTMP app per the
// Beacon plan, so the mobile surface is viewer-only.
import { authedFetch } from '../../auth/authedFetch';

// Mirrors the web viewer's BeaconEventLike shape from /api/beacon/current.
export type BeaconEventLike = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'live' | 'ended';
  recordingUrl: string | null;
};

// The exact JSON shape returned by GET /api/beacon/current.
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

// Public endpoint — works signed-out. The web viewer treats a network blip as
// "keep the last known state"; this throws so the screen can decide to keep its
// previous state on a poll failure rather than blanking the UI.
export async function getBeaconCurrent(): Promise<BeaconCurrentResponse> {
  const res = await authedFetch('/api/beacon/current', { method: 'GET' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => '');
    throw new Error(`Unable to parse beacon response as JSON (status ${res.status}): ${text}`);
  }
  if (!res.ok || !data || data.ok !== true) {
    throw new Error((data && data.message) || `Unable to load the beacon (status ${res.status})`);
  }
  return {
    ok: true,
    event: data.event ?? null,
    hlsPlaybackUrl: data.hlsPlaybackUrl ?? null,
    replay: data.replay ?? null,
  };
}

// Signed-in member only. The CSRF header mirrors the web viewer's joinChat call.
// Returns null when chat is not configured (the route answers 503) or the member
// gate denies (401) — the caller shows a calm "chat unavailable" panel, never crashes.
export async function getBeaconChatCredentials(eventId: string): Promise<BeaconChatCredentials | null> {
  const res = await authedFetch(`/api/beacon/${eventId}/chat-token`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  if (!res.ok) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  if (!data || data.ok !== true) {
    return null;
  }
  return {
    streamApiKey: data.streamApiKey,
    streamChannelType: data.streamChannelType,
    streamChannelId: data.streamChannelId,
    streamUserId: data.streamUserId,
    streamToken: data.streamToken,
  };
}
