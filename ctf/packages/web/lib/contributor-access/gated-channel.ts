import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { getContributorAccessConfig, listChannelMembershipTargets } from './repository';
import {
  GATED_STREAM_CHANNEL_ID,
  GATED_STREAM_CHANNEL_TYPE,
} from './gated-channel-shared';
import { OFFICIAL_SENDER_LABEL } from 'lib/hub/constants';

// Server-side Stream helpers for the single gated contributor channel. Mirrors lib/feed/stream.ts
// exactly (same credential resolver — demo mode selects the *_STAGING app — same create/watch
// fallback, same per-call server client). Server-side clients (apiKey + apiSecret) issue tokens
// and make REST calls; they never open a user WebSocket, so there is no disconnectUser() teardown
// to run — calling it in a finally only risked masking a real error from the channel operation
// (the Commons removed it for the same reason). The only differences are the distinct channel type
// ('ctf-gated': threads on, richer reactions, longer messages, uploads OFF — created once by
// ctf/scripts/setupGatedChannelType.mjs) and that membership is derived ONLY from the
// contributor_access_eligibility flag: eligible members are added, for-cause-revoked members are
// removed, and no other add path exists.

// Fixed system identity that owns the channel (channel creation needs a created_by user; there is
// no acting member during a scheduled sync).
const GATED_SYSTEM_USER_ID = 'ctf-gated-system';

// Stream member ids reuse the Commons convention (`feed-<userId>`) so each member keeps one Stream
// identity across channels.
function streamMemberId(userId: string): string {
  return `feed-${userId}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function createOrWatchGatedChannel(streamClient: StreamChat) {
  const channel = streamClient.channel(GATED_STREAM_CHANNEL_TYPE, GATED_STREAM_CHANNEL_ID, {
    created_by_id: GATED_SYSTEM_USER_ID,
    name: 'Contributors',
  });
  try {
    await channel.create();
  } catch (createErr) {
    console.error('[gated-channel] channel.create() failed:', createErr);
    try {
      await channel.watch();
    } catch (watchErr) {
      console.error('[gated-channel] channel.watch() also failed after create() error:', watchErr, 'Original create() error:', createErr);
      throw watchErr;
    }
  }
  return channel;
}

// Idempotently create the gated channel (no-op when it already exists). Returns false when Stream
// is not configured in this environment — callers degrade instead of failing.
export async function ensureGatedChannel(): Promise<boolean> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) return false;
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  await streamClient.upsertUser({ id: GATED_SYSTEM_USER_ID, name: OFFICIAL_SENDER_LABEL });
  await createOrWatchGatedChannel(streamClient);
  return true;
}

export type GatedChannelSyncResult = {
  added: number;
  removed: number;
};

// Sync Stream channel membership from the eligibility flag — the ONLY membership path (proposal:
// membership is synced from the flag; a for-cause revoke removes access). Adds every eligible
// member, removes every revoked-for-cause member. Returns null when Stream is unconfigured.
export async function syncGatedChannelMembership(): Promise<GatedChannelSyncResult | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) return null;
  const targets = await listChannelMembershipTargets();
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  await streamClient.upsertUser({ id: GATED_SYSTEM_USER_ID, name: OFFICIAL_SENDER_LABEL });
  const channel = await createOrWatchGatedChannel(streamClient);

  const eligibleIds = targets.eligibleUserIds.map(streamMemberId);
  const revokedIds = targets.revokedUserIds.map(streamMemberId);

  // Stream member/user calls are capped per request, so batch in chunks of 100.
  for (const ids of chunk(eligibleIds, 100)) {
    await streamClient.upsertUsers(ids.map((id) => ({ id })));
    await channel.addMembers(ids);
  }
  for (const ids of chunk(revokedIds, 100)) {
    await channel.removeMembers(ids);
  }

  return { added: eligibleIds.length, removed: revokedIds.length };
}

// Guarded membership sync for the eligibility-changing paths (recompute, revoke, reinstate).
// Runs only while the channel is open; a Stream (or config-read) failure NEVER fails the caller —
// it is reported and returned as a warning string for the caller's JSON response. Membership
// reconciles on the next sync.
export async function syncGatedChannelMembershipIfOpen(op: string): Promise<string | undefined> {
  try {
    const config = await getContributorAccessConfig();
    if (!config.channelOpen) {
      return undefined;
    }
    await syncGatedChannelMembership();
    return undefined;
  } catch (error) {
    reportError(error, { area: 'contributor-access', op });
    return 'Gated channel membership sync failed; it reconciles on the next sync.';
  }
}

// Best-effort member count for the admin status card. Null when Stream is unconfigured or the
// read fails — the card shows "not synced" instead of breaking.
export async function getGatedChannelMemberCount(): Promise<number | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) return null;
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const channel = streamClient.channel(GATED_STREAM_CHANNEL_TYPE, GATED_STREAM_CHANNEL_ID);
    const state = await channel.query({ members: { limit: 1 } });
    return typeof state.channel.member_count === 'number' ? state.channel.member_count : null;
  } catch {
    return null;
  }
}

export type GatedStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelType: string;
  streamChannelId: string;
};

// Mint live-layer credentials for a member the CALLER has already verified against the
// eligibility flag (the /api/contributor-access/channel/join gate). The add here is still
// flag-derived — it only reconciles the verified member into the synced membership; it is not a
// second grant path. Mirrors getFeedStreamCredentials.
export async function getGatedStreamCredentials(
  userId: string,
  displayName: string,
): Promise<GatedStreamCredentials | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) return null;
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  const streamUserId = streamMemberId(userId);
  await streamClient.upsertUser({ id: streamUserId, name: displayName });
  const token = streamClient.createToken(streamUserId);
  const channel = await createOrWatchGatedChannel(streamClient);
  await channel.addMembers([streamUserId]);
  return {
    streamApiKey: streamConfig.apiKey,
    streamToken: token,
    streamUserId,
    streamChannelType: GATED_STREAM_CHANNEL_TYPE,
    streamChannelId: GATED_STREAM_CHANNEL_ID,
  };
}
