import { StreamChat } from 'stream-chat';

export const CHYME_STREAM_CHANNEL_ID = 'chyme-main-room';

type StreamConfig = {
  apiKey: string;
  apiSecret: string;
};

export type ChymeStreamJoinCredentials = {
  streamApiKey: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

function getStreamConfig(): StreamConfig | null {
  const apiKey = process.env.STREAM_API_KEY?.trim();
  const apiSecret = process.env.STREAM_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
}

function toStreamUserId(userId: string): string {
  return `chyme-${userId}`;
}

async function ensureMember(streamClient: StreamChat, userId: string, displayName: string): Promise<string> {
  const streamUserId = toStreamUserId(userId);
  await streamClient.upsertUser({
    id: streamUserId,
    name: displayName,
  });
  return streamUserId;
}

async function ensureChannel(streamClient: StreamChat, streamUserId: string) {
  const channel = streamClient.channel('messaging', CHYME_STREAM_CHANNEL_ID, {
    created_by_id: streamUserId,
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

export async function createChymeStreamJoinCredentials(
  userId: string,
  displayName: string,
): Promise<ChymeStreamJoinCredentials | null> {
  const streamConfig = getStreamConfig();
  if (!streamConfig) {
    return null;
  }

  const streamClient = StreamChat.getInstance(streamConfig.apiKey, streamConfig.apiSecret);
  const streamUserId = await ensureMember(streamClient, userId, displayName);
  const channel = await ensureChannel(streamClient, streamUserId);

  return {
    streamApiKey: streamConfig.apiKey,
    streamChannelId: channel.id ?? CHYME_STREAM_CHANNEL_ID,
    streamUserId,
    streamToken: streamClient.createToken(streamUserId),
  };
}

export async function sendChymeStreamMessage(input: {
  userId: string;
  displayName: string;
  text: string;
}): Promise<string | null> {
  const streamConfig = getStreamConfig();
  if (!streamConfig) {
    return null;
  }

  const streamClient = StreamChat.getInstance(streamConfig.apiKey, streamConfig.apiSecret);
  const streamUserId = await ensureMember(streamClient, input.userId, input.displayName);
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
}
