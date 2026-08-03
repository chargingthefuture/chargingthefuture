import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';

export type FoundationStreamParticipantCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

function toStreamUserId(userId: string): string {
  return `foundation-${userId}`;
}

// Delete a member's Foundation data on Stream when they delete their account. Foundation thread chat is
// sent directly into Stream Chat under `foundation-<userId>`, so Stream keeps a copy a Postgres delete
// does not remove. Hard-deletes the member's Stream user with `mark_messages_deleted`. Best-effort:
// returns `false` (never throws) when Stream is unconfigured or the call fails, so the account-deletion
// hook that calls this can log and continue without blocking the deletion.
export async function deleteFoundationStreamData(userId: string): Promise<boolean> {
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

  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
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
      // no-trace: a failed create means the channel already exists, so watching it is the answer.
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
  } catch (error) {
    // Credentials are present but the Stream app rejected the call (bad/expired keys, an unreachable
    // app, a transient outage). Degrade exactly like the no-credentials path above (return null) so a
    // Stream failure does not hard-fail Request Quote — the caller still creates the thread with a
    // synthetic channel id. This matters most in demo mode, which routes to a separate staging Stream
    // app: if that app is misconfigured, quoting must still work. Logged so the real cause is visible.
    reportError(error, { area: 'foundation', op: 'ensure_stream_channel' });
    return null;
  } finally {
    await streamClient.disconnectUser().catch(() => {});
  }
}

export async function createFoundationParticipantToken(userId: string, displayName: string): Promise<FoundationStreamParticipantCredentials | null> {
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
  } catch (error) {
    // Same graceful degrade as ensureFoundationStreamChannel: present-but-bad credentials return null
    // instead of throwing, so the thread-create path lands the member in Quotes rather than failing. The
    // Direct Line token route treats null as 'stream_unavailable', which is the honest place for the
    // "chat is unavailable" message to surface — not on quote creation.
    reportError(error, { area: 'foundation', op: 'participant_token' });
    return null;
  } finally {
    await streamClient.disconnectUser().catch(() => {});
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

  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
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
