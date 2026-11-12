import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { isStreamNotFoundError } from 'lib/shared/stream-error-text';

export type SocketRelayStreamParticipantCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

function toStreamUserId(userId: string): string {
  return `socket-relay-${userId}`;
}

// Delete a member's SocketRelay data on Stream when they delete their account. Fulfillment thread chat
// is sent directly into Stream Chat under `socket-relay-<userId>`, so Stream keeps a copy a Postgres
// delete does not remove. Hard-deletes the member's Stream user with `mark_messages_deleted`.
// Best-effort: returns `false` (never throws) when Stream is unconfigured or the call fails, so the
// account-deletion hook that calls this can log and continue without blocking the deletion.
export async function deleteSocketRelayStreamData(userId: string): Promise<boolean> {
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
    // A Stream user that does not exist has nothing to delete.
    if (isStreamNotFoundError(error)) {
      return true;
    }
    // Still best-effort (the deletion goes on), but the reason is recorded: without it the account
    // cleanup could not tell "Stream unconfigured" from "Stream refused the delete".
    reportError(error, { area: 'socket-relay', op: 'stream_delete_user', extra: { streamUserId: toStreamUserId(userId) } });
    return false;
  }
}

async function upsertStreamUser(streamClient: StreamChat, userId: string, displayName: string): Promise<string> {
  const streamUserId = toStreamUserId(userId);
  await streamClient.upsertUser({ id: streamUserId, name: displayName });
  return streamUserId;
}

// The Direct Line a fulfillment had on Stream before 3.1, read-only. Conversations now live in the
// request card's Just us two (commons_item_messages); the messages written on Stream stay where they
// are and are shown as a short history under the request. Nothing new is created: a fulfillment with
// no channel returns null. The channel is frozen on first open, so neither member can write in it
// again even with a token. Messages there were never copied: they live on Stream, not in this
// database, and could carry pictures a card conversation does not hold.
export async function openFulfillmentHistoryChannel(fulfillmentId: string): Promise<string | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }
  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  const streamChannelId = `socket-relay-fulfillment-${fulfillmentId}`;
  const [channel] = await streamClient.queryChannels({ type: 'messaging', id: streamChannelId }, {}, { limit: 1, watch: false, state: false });
  if (!channel) {
    return null;
  }
  if (channel.data?.frozen !== true) {
    await channel.updatePartial({ set: { frozen: true } });
  }
  return streamChannelId;
}

export async function createSocketRelayParticipantToken(userId: string, displayName: string): Promise<SocketRelayStreamParticipantCredentials | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  // Server-side client (API secret): no user connection to tear down, so no disconnectUser call.
  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  const streamUserId = await upsertStreamUser(streamClient, userId, displayName);

  return {
    streamApiKey: config.apiKey,
    streamUserId,
    streamToken: streamClient.createToken(streamUserId),
  };
}
