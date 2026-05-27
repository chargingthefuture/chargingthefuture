import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';

export type SocketRelayStreamParticipantCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

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
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  const streamClient = new StreamChat(config.apiKey, { apiSecret: config.apiSecret });
  try {
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
  } finally {
    await streamClient.disconnectUser();
  }
}

export async function createSocketRelayParticipantToken(userId: string, displayName: string): Promise<SocketRelayStreamParticipantCredentials | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  const streamClient = new StreamChat(config.apiKey, { apiSecret: config.apiSecret });
  try {
    const streamUserId = await upsertStreamUser(streamClient, userId, displayName);

    return {
      streamApiKey: config.apiKey,
      streamUserId,
      streamToken: streamClient.createToken(streamUserId),
    };
  } finally {
    await streamClient.disconnectUser();
  }
}
