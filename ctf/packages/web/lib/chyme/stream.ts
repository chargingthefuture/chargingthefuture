import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';

export const CHYME_STREAM_CHANNEL_ID = 'chyme-main-room';

export type StreamJoinCredentials = {
  streamApiKey: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

function toStreamUserId(userId: string): string {
  return `chyme-${userId}`;
}

async function ensureMember(streamClient: StreamChat, userId: string, name: string): Promise<string> {
  const streamUserId = toStreamUserId(userId);
  await streamClient.upsertUser({
    id: streamUserId,
    name,
  });
  return streamUserId;
}

async function ensureChannel(streamClient: StreamChat, streamUserId: string) {
  const channel = streamClient.channel('messaging', CHYME_STREAM_CHANNEL_ID, {
    created_by_id: streamUserId,
    // Cosmetic GetStream channel display name; members see the DB room_name, and this only
    // applies to newly created channels. Left as-is so this rename touches no Stream code
    // (avoids the quota-impact gate for a change with zero Stream-usage impact).
    name: 'Chyme Main Room',
  });

  try {
    await channel.create();
  } catch {
    await channel.watch();
  }

  await channel.addMembers([streamUserId]);
  return channel;
}

export async function createStreamJoinCredentials(
  userId: string,
  name: string,
): Promise<StreamJoinCredentials | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const streamUserId = await ensureMember(streamClient, userId, name);
    const channel = await ensureChannel(streamClient, streamUserId);

    return {
      streamApiKey: streamConfig.apiKey,
      streamChannelId: channel.id ?? CHYME_STREAM_CHANNEL_ID,
      streamUserId,
      streamToken: streamClient.createToken(streamUserId),
    };
  } finally {
    await streamClient.disconnectUser();
  }
}

export async function sendChymeStreamMessage(input: {
  userId: string;
  name: string;
  text: string;
}): Promise<string | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const streamUserId = await ensureMember(streamClient, input.userId, input.name);
    const channel = await ensureChannel(streamClient, streamUserId);

    try {
      const result = await channel.sendMessage({
        text: input.text,
        user_id: streamUserId,
      });

      return result.message?.id ?? null;
    } catch {
      return null;
    }
  } finally {
    await streamClient.disconnectUser();
  }
}
