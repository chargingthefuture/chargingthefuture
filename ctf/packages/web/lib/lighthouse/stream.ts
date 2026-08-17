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

// Delete a member's Lighthouse data on Stream when they delete their account. Match thread chat is sent
// directly into Stream Chat under `lighthouse-<userId>`, so Stream keeps a copy a Postgres delete does
// not remove. Hard-deletes the member's Stream user with `mark_messages_deleted`. Best-effort: returns
// `false` (never throws) when Stream is unconfigured or the call fails, so the account-deletion hook
// that calls this can log and continue without blocking the deletion.
export async function deleteLighthouseStreamData(userId: string): Promise<boolean> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return false;
  }
  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  try {
    await streamClient.deleteUser(toStreamUserId(userId), {
      mark_messages_deleted: true,
      hard_delete: true,
    });
    return true;
  } catch {
    return false;
  }
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

  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  try {
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
      // no-trace: a failed create means the channel already exists, so watching it is the answer.
      await channel.watch();
    }

    await channel.addMembers([seekerStreamUserId, hostStreamUserId]);
    return streamChannelId;
  } finally {
    await streamClient.disconnectUser();
  }
}

export async function createLighthouseParticipantToken(userId: string, displayName: string): Promise<LighthouseStreamParticipantCredentials | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
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
