import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { streamChannelSetupFailure } from 'lib/shared/stream-error-text';

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
  } catch (error) {
    // Still best-effort (the deletion goes on), but the reason is recorded: without it the account
    // cleanup could not tell "Stream unconfigured" from "Stream refused the delete".
    reportError(error, { area: 'foundation', op: 'stream_delete_user', extra: { streamUserId: toStreamUserId(userId) } });
    return false;
  }
}

// How long the Stream chat-channel setup in ensureFoundationStreamChannel may take before it gives up.
//
// That function is called from INSIDE an open Postgres transaction (createConnectionThread), so for as
// long as it runs it is holding a pooled database connection. Its work is several HTTP round trips to
// Stream — two user upserts, a channel create, an add-members. With no bound, one unreachable or very
// slow Stream app keeps every in-flight Foundation connection holding a database connection until the
// pool runs out, and then nothing in Foundation works. The function already degrades to `null` on any
// failure (the thread is created with a synthetic channel id); the timeout just makes that degrade
// happen promptly instead of never.
const STREAM_CHANNEL_SETUP_TIMEOUT_MS = 8000;

class StreamSetupTimeoutError extends Error {
  constructor(ms: number) {
    super(`Stream channel setup did not finish within ${ms}ms`);
    this.name = 'StreamSetupTimeoutError';
  }
}

// Resolve `work`, or reject with StreamSetupTimeoutError once `ms` has passed. The timer is always
// cleared so a fast result does not keep the process awake.
async function withStreamTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new StreamSetupTimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
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
    return await withStreamTimeout((async () => {
      const survivorStreamUserId = await upsertStreamUser(streamClient, input.survivorUserId, input.survivorDisplayName);
      const providerStreamUserId = await upsertStreamUser(streamClient, input.providerUserId, input.providerDisplayName);

      const streamChannelId = `foundation-thread-${input.threadId}`;
      const channel = streamClient.channel('messaging', streamChannelId, {
        created_by_id: survivorStreamUserId,
        name: 'Foundation 1:1 Thread',
      });

      try {
        await channel.create();
      } catch (createError) {
        // A failed create usually means the channel already exists, and watching it is then the answer.
        // When the watch fails too, the thrown reason names both failures instead of only the second.
        try {
          await channel.watch();
        } catch (watchError) {
          throw new Error(streamChannelSetupFailure(streamChannelId, createError, watchError));
        }
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
    })(), STREAM_CHANNEL_SETUP_TIMEOUT_MS);
  } catch (error) {
    // Credentials are present but the Stream app rejected the call (bad/expired keys, an unreachable
    // app, a transient outage), or it did not answer inside STREAM_CHANNEL_SETUP_TIMEOUT_MS. Degrade
    // exactly like the no-credentials path above (return null) so a Stream failure does not hard-fail
    // Request Quote — the caller still creates the thread with a synthetic channel id. This matters most
    // in demo mode, which routes to a separate staging Stream app: if that app is misconfigured, quoting
    // must still work. Logged so the real cause is visible.
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
    // Bounded for the same reason as the channel setup above: createConnectionThread calls this while
    // its Postgres transaction is still open, so an unanswered Stream request would hold a pooled
    // database connection for as long as Stream took to not answer.
    const streamUserId = await withStreamTimeout(
      upsertStreamUser(streamClient, userId, displayName),
      STREAM_CHANNEL_SETUP_TIMEOUT_MS,
    );
    return {
      streamApiKey: config.apiKey,
      streamUserId,
      streamToken: streamClient.createToken(streamUserId),
    };
  } catch (error) {
    // Same graceful degrade as ensureFoundationStreamChannel: present-but-bad credentials (or a Stream
    // app that did not answer in time) return null instead of throwing, so the thread-create path lands
    // the member in Quotes rather than failing. The Direct Line token route treats null as
    // 'stream_unavailable', which is the honest place for the "chat is unavailable" message to surface —
    // not on quote creation.
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
    } catch (error) {
      // The message is already stored in Postgres; the Stream copy is a fan-out. Recorded with its
      // channel, then swallowed so the member's send still succeeds.
      reportError(error, { area: 'foundation', op: 'stream_fanout_send', extra: { streamChannelId: input.streamChannelId, streamUserId } });
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
