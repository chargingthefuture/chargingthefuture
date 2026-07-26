import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';

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
  } catch {
    return false;
  }
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

  // Server-side StreamChat client (built with the API secret): it holds no user connection, so there
  // is nothing to disconnect — the client is simply let go out of scope when this function returns.
  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  const requesterStreamUserId = await upsertStreamUser(streamClient, input.requesterUserId, input.requesterDisplayName);
  const fulfillerStreamUserId = await upsertStreamUser(streamClient, input.fulfillerUserId, input.fulfillerDisplayName);

  const streamChannelId = `socket-relay-fulfillment-${input.fulfillmentId}`;
  const channel = streamClient.channel('messaging', streamChannelId, {
    created_by_id: requesterStreamUserId,
    name: 'SocketRelay Fulfillment Thread',
  });

  // create() fails in the common, benign case where the channel already exists — fall back to watch()
  // to attach to it. But a genuine failure (auth, network, bad id) makes watch() fail too; when it
  // does, surface the original create error (it is otherwise masked behind the watch error) so the
  // real cause is not swallowed, then rethrow so the caller sees the failure.
  try {
    await channel.create();
  } catch (createError) {
    try {
      await channel.watch();
    } catch (watchError) {
      reportError(createError, { area: 'socket-relay', op: 'ensure_channel_create' });
      throw watchError;
    }
  }

  await channel.addMembers([requesterStreamUserId, fulfillerStreamUserId]);
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
