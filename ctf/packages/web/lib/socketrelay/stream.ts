import { StreamChat } from 'stream-chat';

type StreamConfig = {
  apiKey: string;
  apiSecret: string;
};

export type SocketRelayStreamParticipantCredentials = {
  streamApiKey: string;
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
  return `socketrelay-${userId}`;
}

async function upsertStreamUser(streamClient: StreamChat, userId: string, displayName: string): Promise<string> {
  const streamUserId = toStreamUserId(userId);
  await streamClient.upsertUser({ id: streamUserId, name: displayName });
  return streamUserId;
}

export async function ensureSocketRelayFulfillmentChannel(input: {
  fulfillmentId: string;
  requesterUserId: string;
  requesterDisplayName: string;
  fulfillerUserId: string;
  fulfillerDisplayName: string;
}): Promise<string | null> {
  const config = getStreamConfig();
  if (!config) {
    return null;
  }

  const streamClient = StreamChat.getInstance(config.apiKey, config.apiSecret);
  const requesterStreamUserId = await upsertStreamUser(streamClient, input.requesterUserId, input.requesterDisplayName);
  const fulfillerStreamUserId = await upsertStreamUser(streamClient, input.fulfillerUserId, input.fulfillerDisplayName);

  const streamChannelId = `socketrelay-fulfillment-${input.fulfillmentId}`;
  const channel = streamClient.channel('messaging', streamChannelId, {
    created_by_id: requesterStreamUserId,
    name: 'SocketRelay Fulfillment Thread',
  });

  try {
    await channel.create();
  } catch {
    await channel.watch();
  }

  await channel.addMembers([requesterStreamUserId, fulfillerStreamUserId]);
  return streamChannelId;
}

export async function createSocketRelayParticipantToken(userId: string, displayName: string): Promise<SocketRelayStreamParticipantCredentials | null> {
  const config = getStreamConfig();
  if (!config) {
    return null;
  }

  const streamClient = StreamChat.getInstance(config.apiKey, config.apiSecret);
  const streamUserId = await upsertStreamUser(streamClient, userId, displayName);

  return {
    streamApiKey: config.apiKey,
    streamUserId,
    streamToken: streamClient.createToken(streamUserId),
  };
}
