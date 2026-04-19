export type FeedStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

export async function getFeedStreamCredentials(userId: string, displayName: string): Promise<FeedStreamCredentials | null> {
  const streamConfig = getStreamConfig();
  if (!streamConfig) return null;
  const streamClient = StreamChat.getInstance(streamConfig.apiKey, streamConfig.apiSecret);
  const streamUserId = `feed-${userId}`;
  await streamClient.upsertUser({ id: streamUserId, name: displayName });
  const token = streamClient.createToken(streamUserId);
  const channelId = 'ctf-feed-announcements';
  const channel = streamClient.channel('messaging', channelId, {
    created_by_id: streamUserId,
    name: 'CTF Feed Announcements',
  });
  try {
    await channel.create();
  } catch {
    await channel.watch();
  }
  await channel.addMembers([streamUserId]);
  return {
    streamApiKey: streamConfig.apiKey,
    streamToken: token,
    streamUserId,
    streamChannelId: channelId,
  };
}
import { StreamChat } from 'stream-chat';
import type { EventTypes } from 'stream-chat';
import type { MembershipEventType } from './types';

type StreamConfig = {
  apiKey: string;
  apiSecret: string;
};

function getStreamConfig(): StreamConfig | null {
  const apiKey = process.env.STREAM_API_KEY?.trim();
  const apiSecret = process.env.STREAM_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
}

export async function emitFeedMembershipEventToStream(input: {
  actorId: string;
  userId: string;
  pluginId: string;
  eventType: MembershipEventType;
  requestId: string | null;
  traceId: string | null;
}): Promise<boolean> {
  const streamConfig = getStreamConfig();
  if (!streamConfig) {
    return false;
  }

  const streamClient = StreamChat.getInstance(streamConfig.apiKey, streamConfig.apiSecret);
  const channel = streamClient.channel('messaging', 'ctf-feed-membership-events', {
    created_by_id: `feed-${input.actorId}`,
    name: 'CTF Feed Membership Events',
  });

  try {
    await channel.create();
  } catch {
    await channel.watch();
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
