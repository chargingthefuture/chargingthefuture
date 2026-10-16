import { StreamChat } from 'stream-chat';
import type { EventTypes } from 'stream-chat';
import type { MembershipEventType } from './types';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { streamChannelSetupFailure, isStreamNotFoundError } from 'lib/shared/stream-error-text';

const FEED_MEMBERSHIP_EVENTS_CHANNEL_ID = 'ctf-feed-membership-events';

export type FeedStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

// The Feed presents three channels (announcements, questions, community). They all share one Stream
// user identity and token — only the channel they connect to differs. Callers pass the channel key;
// announcements stays the default so the existing /api/feed/stream route is unchanged.
export type FeedStreamChannelKey = 'announcements' | 'questions' | 'community';

const FEED_STREAM_CHANNELS: Record<FeedStreamChannelKey, { id: string; name: string }> = {
  announcements: { id: 'ctf-feed-announcements', name: 'CTF Feed Announcements' },
  questions: { id: 'ctf-feed-questions', name: 'CTF Feed Questions' },
  community: { id: 'ctf-feed-community', name: 'CTF Feed Community' },
};

export async function getFeedStreamCredentials(
  userId: string,
  displayName: string,
  channelKey: FeedStreamChannelKey = 'announcements',
): Promise<FeedStreamCredentials | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) return null;
  // Server-side client (apiKey + apiSecret): it issues tokens and makes REST calls, it never opens a
  // user WebSocket, so there is nothing to tear down. disconnectUser() is the client-side teardown for
  // a connected user and does not apply here — calling it in a finally only risked masking a real error.
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  const streamUserId = `feed-${userId}`;
  await streamClient.upsertUser({ id: streamUserId, name: displayName });
  const token = streamClient.createToken(streamUserId);
  const channelDef = FEED_STREAM_CHANNELS[channelKey];
  const channelId = channelDef.id;
  const channel = streamClient.channel('messaging', channelId, {
    created_by_id: streamUserId,
    name: channelDef.name,
  });
  try {
    await channel.create();
  } catch (createErr) {
    // A failed create usually means the channel already exists, and watching it is then the answer.
    reportError(createErr, { area: 'feed', op: 'channel_create', extra: { streamChannelId: channelId } });
    try {
      await channel.watch();
    } catch (watchErr) {
      throw new Error(streamChannelSetupFailure(channelId, createErr, watchErr));
    }
  }
  await channel.addMembers([streamUserId]);
  return {
    streamApiKey: streamConfig.apiKey,
    streamToken: token,
    streamUserId,
    streamChannelId: channelId,
  };
}

// Account or Commons deletion: remove the member's `feed-<userId>` Stream user, which carries their
// @username as its name and their Commons (and contributor channel) memberships. The Commons writes
// no chat messages under this identity, so the user record and memberships are all there is; a later
// Commons visit simply creates a fresh one. Returns false when Stream is unconfigured or the delete
// failed (reported), never throws — the external-cleanup registry turns false into a logged failure.
export async function deleteFeedStreamData(userId: string): Promise<boolean> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) return false;
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  const streamUserId = `feed-${userId}`;
  try {
    await streamClient.deleteUser(streamUserId, { mark_messages_deleted: true, hard_delete: true });
    return true;
  } catch (error) {
    // A Stream user that does not exist has nothing to delete.
    if (isStreamNotFoundError(error)) {
      return true;
    }
    reportError(error, { area: 'feed', op: 'stream_delete_user', extra: { streamUserId } });
    return false;
  }
}

export async function emitFeedMembershipEventToStream(input: {
  actorId: string;
  userId: string;
  pluginId: string;
  eventType: MembershipEventType;
  requestId: string | null;
  traceId: string | null;
}): Promise<boolean> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return false;
  }

  // Server-side client: no user WebSocket is opened, so there is no disconnectUser() teardown to run.
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  const channel = streamClient.channel('messaging', FEED_MEMBERSHIP_EVENTS_CHANNEL_ID, {
    created_by_id: `feed-${input.actorId}`,
    name: 'CTF Feed Membership Events',
  });

  try {
    await channel.create();
  } catch (createErr) {
    // A failed create usually means the channel already exists, and watching it is then the answer.
    reportError(createErr, { area: 'feed', op: 'membership_event_channel_create' });
    try {
      await channel.watch();
    } catch (watchErr) {
      throw new Error(streamChannelSetupFailure(FEED_MEMBERSHIP_EVENTS_CHANNEL_ID, createErr, watchErr));
    }
  }

  await channel.sendEvent({
    type: 'feed.membership.updated' as EventTypes,
    eventName: 'feed.membership.updated',
    actorId: input.actorId,
    userId: input.userId,
    pluginId: input.pluginId,
    eventType: input.eventType,
    requestId: input.requestId,
    traceId: input.traceId,
    emittedAt: new Date().toISOString(),
  });

  return true;
}
