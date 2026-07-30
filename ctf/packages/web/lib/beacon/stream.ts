import { createHmac } from 'crypto';
import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { BEACON_CHAT_CHANNEL_TYPE, BEACON_STREAM_CALL_TYPE } from './constants';

// Beacon's Stream Video integration. Beacon is a one-way `livestream`: only the admin host
// publishes; everyone else watches. Watching is public over HLS (no user token needed), which is
// what lets anonymous viewers in and keeps cost off WebRTC fan-out. Chatting needs a signed-in
// member (a Stream Chat token, minted only for members).
//
// There is no @stream-io/node-sdk in the workspace, so server-side call lifecycle (create, goLive,
// end), the per-event RTMP ingest, and the HLS playback URL are driven against Stream's documented
// Video REST API using a server-auth JWT signed with the app secret. Every entry point degrades to
// null/throw-free behavior when Stream is not configured (resolveStreamCredentials() returns null),
// exactly like the PeerProgramming stream helper.

const STREAM_VIDEO_BASE_URL = 'https://video.stream-io-api.com';

// A Stream call id accepts [0-9a-zA-Z_-]; event ids are UUIDs (already safe) but coerce defensively.
export function beaconCallIdForEvent(eventId: string): string {
  const cleaned = `beacon-${eventId}`.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'beacon-event';
}

function beaconStreamUserId(userId: string): string {
  return `beacon-${userId}`.replace(/[^0-9a-zA-Z_@.-]/g, '-');
}

// Delete a member's Beacon data on Stream when they delete their account. Beacon's per-event live chat
// is sent into Stream Chat under `beacon-<userId>`, so Stream keeps a copy of the member's messages —
// this is NOT "ephemeral" as the older deletion contract assumed (Stream retains chat with no expiry by
// default), and Beacon has no member Postgres rows, so a Postgres-only delete leaves nothing to remove
// there but the Stream copy lingers. This hard-deletes the member's Stream user with
// `mark_messages_deleted`. Best-effort: returns `false` (never throws) when Stream is unconfigured or the
// call fails, so the account-deletion hook that calls this can log and continue without blocking.
export async function deleteBeaconStreamData(userId: string): Promise<boolean> {
  const credentials = await resolveStreamCredentials();
  if (!credentials) {
    return false;
  }
  const chatClient = new StreamChat(credentials.apiKey, credentials.apiSecret);
  try {
    await chatClient.deleteUser(beaconStreamUserId(userId), {
      mark_messages_deleted: true,
      hard_delete: true,
    });
    return true;
  } catch {
    return false;
  }
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Mint a Stream server-auth JWT (no user; `server` audience) signed with the app secret, for
// server-to-server Video REST calls. Stream's server SDKs send exactly this token.
function mintServerToken(apiSecret: string): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ server: true, iat: Math.floor(Date.now() / 1000) }));
  const signature = base64Url(createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

type StreamRestContext = {
  apiKey: string;
  apiSecret: string;
  serverToken: string;
};

async function resolveStreamRest(): Promise<StreamRestContext | null> {
  const credentials = await resolveStreamCredentials();
  if (!credentials) {
    return null;
  }
  return {
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    serverToken: mintServerToken(credentials.apiSecret),
  };
}

async function streamVideoFetch(
  ctx: StreamRestContext,
  path: string,
  init: { method: string; body?: unknown },
): Promise<Record<string, unknown>> {
  const url = `${STREAM_VIDEO_BASE_URL}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(ctx.apiKey)}`;
  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: ctx.serverToken,
      'stream-auth-type': 'jwt',
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const text = await response.text();
  const parsed = text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const message = typeof parsed.message === 'string' ? parsed.message : `Stream Video request failed (${response.status}).`;
    throw new Error(message);
  }
  return parsed;
}

export type BeaconHostCredentials = {
  streamApiKey: string;
  streamCallType: string;
  streamCallId: string;
  streamUserId: string;
  hostToken: string;
};

// Mint a host (publisher) token scoped to the host user id. The Stream JWT works for both Video and
// Chat (same app secret), so this token lets the admin publish the in-browser screen-share and act
// as the chat channel moderator. Viewers never receive this token — they watch over public HLS.
export async function createBeaconHostCredentials(input: {
  userId: string;
  name: string;
  eventId: string;
}): Promise<BeaconHostCredentials | null> {
  const credentials = await resolveStreamCredentials();
  if (!credentials) {
    return null;
  }
  const chatClient = new StreamChat(credentials.apiKey, credentials.apiSecret);
  try {
    const streamUserId = beaconStreamUserId(input.userId);
    await chatClient.upsertUser({ id: streamUserId, name: input.name, role: 'admin' });
    return {
      streamApiKey: credentials.apiKey,
      streamCallType: BEACON_STREAM_CALL_TYPE,
      streamCallId: beaconCallIdForEvent(input.eventId),
      streamUserId,
      hostToken: chatClient.createToken(streamUserId),
    };
  } finally {
    await chatClient.disconnectUser();
  }
}

export type BeaconMemberChatCredentials = {
  streamApiKey: string;
  streamChannelType: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

// Mint a Stream Chat token for a signed-in member so they can post in the live event chat. Anonymous
// viewers never reach this path (the route requires a member), which is the sign-in-to-chat gate.
export async function createBeaconMemberChatCredentials(input: {
  userId: string;
  name: string;
  eventId: string;
}): Promise<BeaconMemberChatCredentials | null> {
  const credentials = await resolveStreamCredentials();
  if (!credentials) {
    return null;
  }
  const chatClient = new StreamChat(credentials.apiKey, credentials.apiSecret);
  try {
    const streamUserId = beaconStreamUserId(input.userId);
    await chatClient.upsertUser({ id: streamUserId, name: input.name });
    return {
      streamApiKey: credentials.apiKey,
      streamChannelType: BEACON_CHAT_CHANNEL_TYPE,
      streamChannelId: beaconCallIdForEvent(input.eventId),
      streamUserId,
      streamToken: chatClient.createToken(streamUserId),
    };
  } finally {
    await chatClient.disconnectUser();
  }
}

export type BeaconIngest = {
  rtmpIngestUrl: string;
  streamKey: string;
};

// Create (or get) the Beacon livestream call and return its per-event RTMP ingest URL + stream key
// for a phone broadcaster app. Recording is enabled so Stream delivers a recording-ready webhook
// after the event ends. Returns null when Stream is not configured.
//
// Source: Stream Video RTMP ingress docs (getstream.io/video/docs/api/streaming/rtmp/), confirmed
// 2026-06-21. The RTMP ingest address is on the call response at `call.ingress.rtmp.address`. The
// stream key is NOT a field on the response: the broadcaster authenticates the RTMP push with a host
// user token used as the stream key, so the caller passes the host token it already minted. We read
// the address defensively (optional-chained) and never fabricate it: an absent address yields an
// empty string and the admin surface stays in its not-live state.
export async function ensureBeaconCallAndIngest(input: {
  eventId: string;
  hostUserId: string;
  hostToken: string;
}): Promise<BeaconIngest | null> {
  const ctx = await resolveStreamRest();
  if (!ctx) {
    return null;
  }
  const callId = beaconCallIdForEvent(input.eventId);
  const created = await streamVideoFetch(ctx, `/api/v2/video/call/${BEACON_STREAM_CALL_TYPE}/${callId}`, {
    method: 'POST',
    body: {
      data: {
        created_by_id: beaconStreamUserId(input.hostUserId),
        settings_override: {
          // Backstage on: the call is not visible to viewers until goLive() is called.
          backstage: { enabled: true },
          recording: { mode: 'available' },
        },
      },
    },
  });
  const call = (created.call ?? {}) as Record<string, unknown>;
  const ingress = (call.ingress ?? {}) as Record<string, unknown>;
  const rtmp = (ingress.rtmp ?? {}) as Record<string, unknown>;
  const address = typeof rtmp.address === 'string' ? rtmp.address : '';
  // The broadcaster app pushes RTMP to `address` and authenticates with the host token as stream key.
  return { rtmpIngestUrl: address, streamKey: input.hostToken };
}

// Flip the call out of backstage so viewers can watch. Returns false when Stream is not configured.
// This intentionally does NOT start HLS or recording: at the moment the admin clicks "Go live" there
// is no publisher yet (the in-browser screen-share host mounts after go-live succeeds), and Stream
// rejects starting HLS/recording with no active publisher. HLS and recording are started separately
// by startBeaconBroadcastEgress once a publisher is actually live.
export async function goLiveBeaconCall(eventId: string): Promise<boolean> {
  const ctx = await resolveStreamRest();
  if (!ctx) {
    return false;
  }
  const callId = beaconCallIdForEvent(eventId);
  // Source: Stream Video broadcasting/HLS docs (getstream.io/video/docs/api/streaming/hls/),
  // confirmed 2026-06-21. POST /api/v2/video/call/{type}/{id}/go_live flips the call out of backstage
  // so viewers can join. Sending an empty body here starts neither HLS nor recording — those begin
  // later via startBeaconBroadcastEgress when media is present.
  await streamVideoFetch(ctx, `/api/v2/video/call/${BEACON_STREAM_CALL_TYPE}/${callId}/go_live`, {
    method: 'POST',
    body: {},
  });
  return true;
}

// Start the public HLS broadcast and the recording once a publisher is actually live. Returns false
// when Stream is not configured.
//
// Source: Stream Video HLS docs (getstream.io/video/docs/api/streaming/hls/), confirmed 2026-06-21.
// go_live is idempotent on an already-live call: calling POST /api/v2/video/call/{type}/{id}/go_live
// again with start_hls + start_recording starts the HLS broadcast and recording now that media is
// present, which avoids guessing standalone start-HLS/start-recording endpoint names. start_hls
// begins the public HLS broadcast (the response carries `egress.hls.playlist_url`, read by
// getBeaconHlsPlaybackUrl) and start_recording feeds the recording-ready webhook.
export async function startBeaconBroadcastEgress(eventId: string): Promise<boolean> {
  const ctx = await resolveStreamRest();
  if (!ctx) {
    return false;
  }
  const callId = beaconCallIdForEvent(eventId);
  await streamVideoFetch(ctx, `/api/v2/video/call/${BEACON_STREAM_CALL_TYPE}/${callId}/go_live`, {
    method: 'POST',
    body: { start_hls: true, start_recording: true },
  });
  return true;
}

// Return the public HLS playback URL for the live call so anonymous viewers can watch with no token.
// Source: Stream Video HLS docs (getstream.io/video/docs/api/streaming/hls/), confirmed 2026-06-21.
// The GET call response exposes the playlist URL at `call.egress.hls.playlist_url`. We read it
// defensively (optional-chained) and never fabricate a URL: when absent this returns null and the
// viewer stays in its idle/starting state.
export async function getBeaconHlsPlaybackUrl(eventId: string): Promise<string | null> {
  const ctx = await resolveStreamRest();
  if (!ctx) {
    return null;
  }
  const callId = beaconCallIdForEvent(eventId);
  const result = await streamVideoFetch(ctx, `/api/v2/video/call/${BEACON_STREAM_CALL_TYPE}/${callId}`, {
    method: 'GET',
  });
  const call = (result.call ?? {}) as Record<string, unknown>;
  const egress = (call.egress ?? {}) as Record<string, unknown>;
  const hls = (egress.hls ?? {}) as Record<string, unknown>;
  const playlistUrl = typeof hls.playlist_url === 'string' ? hls.playlist_url : '';
  return playlistUrl.length > 0 ? playlistUrl : null;
}

// End the call so Stream stops distribution and billing stops. This is the cost-critical path: the
// End-event route must call this. Returns false when Stream is not configured (nothing to stop).
export async function endBeaconCall(eventId: string): Promise<boolean> {
  const ctx = await resolveStreamRest();
  if (!ctx) {
    return false;
  }
  const callId = beaconCallIdForEvent(eventId);
  // Source: Stream Video broadcasting docs (getstream.io/video/docs/api/streaming/), confirmed
  // 2026-06-21. POST /api/v2/video/call/{type}/{id}/stop_live ends the live broadcast (stops HLS
  // distribution and backstages the call), which stops the cost-driving distribution.
  await streamVideoFetch(ctx, `/api/v2/video/call/${BEACON_STREAM_CALL_TYPE}/${callId}/stop_live`, {
    method: 'POST',
    body: {},
  });
  return true;
}

export type BeaconModerationAction = 'mute' | 'ban' | 'slow_mode';

// Apply the slow_mode toggle to the event chat channel: a positive cooldown enables slow-mode with
// that cooldown, anything else (null/undefined/0/negative) disables it.
async function applyBeaconSlowMode(
  channel: ReturnType<StreamChat['channel']>,
  cooldownSeconds?: number | null,
): Promise<void> {
  const seconds = cooldownSeconds && cooldownSeconds > 0 ? cooldownSeconds : 0;
  if (seconds > 0) {
    await channel.enableSlowMode(seconds);
  } else {
    await channel.disableSlowMode();
  }
}

// Moderate the event chat channel: mute or ban a member, or toggle slow-mode. The admin host is the
// channel's server-side moderator. Returns false when Stream is not configured.
export async function moderateBeaconChat(input: {
  eventId: string;
  hostUserId: string;
  action: BeaconModerationAction;
  targetUserId?: string | null;
  cooldownSeconds?: number | null;
}): Promise<boolean> {
  const credentials = await resolveStreamCredentials();
  if (!credentials) {
    return false;
  }
  const chatClient = new StreamChat(credentials.apiKey, credentials.apiSecret);
  try {
    const channelId = beaconCallIdForEvent(input.eventId);
    const channel = chatClient.channel(BEACON_CHAT_CHANNEL_TYPE, channelId);
    const target = input.targetUserId ? beaconStreamUserId(input.targetUserId) : null;
    if (input.action === 'mute' && target) {
      await chatClient.muteUser(target, beaconStreamUserId(input.hostUserId));
      return true;
    }
    if (input.action === 'ban' && target) {
      // Ban from this event's channel only — Beacon is per-event, not a global ban. The channel-level
      // banUser scopes the ban to this channel.
      await channel.banUser(target, { banned_by_id: beaconStreamUserId(input.hostUserId) });
      return true;
    }
    if (input.action === 'slow_mode') {
      await applyBeaconSlowMode(channel, input.cooldownSeconds);
      return true;
    }
    return false;
  } finally {
    await chatClient.disconnectUser();
  }
}

// Verify the Stream webhook signature. Stream signs the raw body with the app secret (HMAC-SHA256)
// and sends it in the `x-signature` header. A request whose signature does not match is rejected.
export async function verifyBeaconWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) {
    return false;
  }
  const credentials = await resolveStreamCredentials();
  if (!credentials) {
    return false;
  }
  const expected = createHmac('sha256', credentials.apiSecret).update(rawBody).digest('hex');
  // Length-guard before compare so a malformed signature can't throw.
  if (expected.length !== signature.length) {
    return false;
  }
  // Constant-time-ish compare.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
