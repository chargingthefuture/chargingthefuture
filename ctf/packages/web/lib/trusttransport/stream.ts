import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';

export type TrustTransportStreamParticipantCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

function toStreamUserId(userId: string): string {
  return `trusttransport-${userId}`;
}

async function upsertStreamUser(streamClient: StreamChat, userId: string): Promise<string> {
  const streamUserId = toStreamUserId(userId);
  await streamClient.upsertUser({ id: streamUserId, name: streamUserId });
  return streamUserId;
}

export async function ensureTrustTransportTripChannel(input: {
  tripId: string;
  requesterUserId: string;
  providerUserId: string;
}): Promise<string | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  try {
    const requesterStreamUserId = await upsertStreamUser(streamClient, input.requesterUserId);
    const providerStreamUserId = await upsertStreamUser(streamClient, input.providerUserId);

    const streamChannelId = `trusttransport-trip-${input.tripId}`;
    const channel = streamClient.channel('messaging', streamChannelId, {
      created_by_id: requesterStreamUserId,
      name: 'TrustTransport Trip Thread',
    });

    try {
      await channel.create();
    } catch {
      await channel.watch();
    }

    await channel.addMembers([requesterStreamUserId, providerStreamUserId]);
    return streamChannelId;
  } finally {
    await streamClient.disconnectUser();
  }
}

export async function createTrustTransportParticipantToken(userId: string): Promise<TrustTransportStreamParticipantCredentials | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  try {
    const streamUserId = await upsertStreamUser(streamClient, userId);

    return {
      streamApiKey: config.apiKey,
      streamUserId,
      streamToken: streamClient.createToken(streamUserId),
    };
  } finally {
    await streamClient.disconnectUser();
  }
}
