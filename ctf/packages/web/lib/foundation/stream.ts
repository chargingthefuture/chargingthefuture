import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';

export type FoundationStreamParticipantCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

function toStreamUserId(userId: string): string {
  return `foundation-${userId}`;
}

async function upsertStreamUser(streamClient: StreamChat, userId: string, displayName: string): Promise<string> {
  const streamUserId = toStreamUserId(userId);
  await streamClient.upsertUser({
    id: streamUserId,
    name: displayName,
  });
  return streamUserId;
}

export async function ensureFoundationStreamChannel(input: {
  threadId: string;
  survivorUserId: string;
  survivorDisplayName: string;
  providerUserId: string;
  providerDisplayName: string;
}): Promise<{ streamChannelId: string; credentials: FoundationStreamParticipantCredentials } | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  const streamClient = new StreamChat(config.apiKey, { apiSecret: config.apiSecret });
  try {
    const survivorStreamUserId = await upsertStreamUser(streamClient, input.survivorUserId, input.survivorDisplayName);
    const providerStreamUserId = await upsertStreamUser(streamClient, input.providerUserId, input.providerDisplayName);

    const streamChannelId = `foundation-thread-${input.threadId}`;
    const channel = streamClient.channel('messaging', streamChannelId, {
      created_by_id: survivorStreamUserId,
      name: 'Foundation 1:1 Thread',
    });

    try {
      await channel.create();
    } catch {
      await channel.watch();
    }

    await channel.addMembers([survivorStreamUserId, providerStreamUserId]);

    return {
      streamChannelId,
      credentials: {
        streamApiKey: config.apiKey,
        streamUserId: survivorStreamUserId,
        streamToken: streamClient.createToken(survivorStreamUserId),
      },
    };
  } finally {
    await streamClient.disconnectUser();
  }
}

export async function createFoundationParticipantToken(userId: string, displayName: string): Promise<FoundationStreamParticipantCredentials | null> {
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

export async function sendFoundationStreamMessage(input: {
  streamChannelId: string;
  senderUserId: string;
  senderDisplayName: string;
  messageText: string;
}): Promise<string | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  const streamClient = new StreamChat(config.apiKey, { apiSecret: config.apiSecret });
  try {
    const streamUserId = await upsertStreamUser(streamClient, input.senderUserId, input.senderDisplayName);
    const channel = streamClient.channel('messaging', input.streamChannelId);

    try {
      await channel.watch();
      const result = await channel.sendMessage({
        text: input.messageText,
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

export async function createFoundationCallToken(input: {
  userId: string;
  displayName: string;
}): Promise<FoundationStreamParticipantCredentials | null> {
  return createFoundationParticipantToken(input.userId, input.displayName);
}
