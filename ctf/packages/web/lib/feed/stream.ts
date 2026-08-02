import { StreamChat } from 'stream-chat';
import type { EventTypes } from 'stream-chat';
import type { MembershipEventType } from './types';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';

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
    // Log the error from channel.create()
    console.error('[getFeedStreamCredentials] channel.create() failed:', createErr);
    try {
      await channel.watch();
    } catch (watchErr) {
      // Log both errors for debugging
      console.error('[getFeedStreamCredentials] channel.watch() also failed after create() error:', watchErr, 'Original create() error:', createErr);
      throw watchErr;
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
  const channel = streamClient.channel('messaging', 'ctf-feed-membership-events', {
    created_by_id: `feed-${input.actorId}`,
    name: 'CTF Feed Membership Events',
  });

  try {
    await channel.create();
  } catch (createErr) {
    // Log the error from channel.create()
    console.error('[emitFeedMembershipEventToStream] channel.create() failed:', createErr);
    try {
      await channel.watch();
    } catch (watchErr) {
      // Log both errors for debugging
      console.error('[emitFeedMembershipEventToStream] channel.watch() also failed after create() error:', watchErr, 'Original create() error:', createErr);
      throw watchErr;
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
