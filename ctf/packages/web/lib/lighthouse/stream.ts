import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';

export type LighthouseStreamParticipantCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

function toStreamUserId(userId: string): string {
  return `lighthouse-${userId}`;
}

async function upsertStreamUser(streamClient: StreamChat, userId: string, displayName: string): Promise<string> {
  const streamUserId = toStreamUserId(userId);
  await streamClient.upsertUser({ id: streamUserId, name: displayName });
  return streamUserId;
}

export async function ensureLighthouseMatchChannel(input: {
  matchId: string;
  seekerUserId: string;
  seekerDisplayName: string;
  hostUserId: string;
  hostDisplayName: string;
}): Promise<string | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  const streamClient = StreamChat.getInstance(config.apiKey, config.apiSecret);
  const seekerStreamUserId = await upsertStreamUser(streamClient, input.seekerUserId, input.seekerDisplayName);
  const hostStreamUserId = await upsertStreamUser(streamClient, input.hostUserId, input.hostDisplayName);

  const streamChannelId = `lighthouse-match-${input.matchId}`;
  const channel = streamClient.channel('messaging', streamChannelId, {
    created_by_id: seekerStreamUserId,
    name: 'LightHouse Match Thread',
  });

  try {
    await channel.create();
  } catch {
    await channel.watch();
  }

  await channel.addMembers([seekerStreamUserId, hostStreamUserId]);
  return streamChannelId;
}

export async function createLighthouseParticipantToken(userId: string, displayName: string): Promise<LighthouseStreamParticipantCredentials | null> {
  const config = await resolveStreamCredentials();
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
