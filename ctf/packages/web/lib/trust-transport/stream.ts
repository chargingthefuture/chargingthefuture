import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { streamChannelSetupFailure } from 'lib/shared/stream-error-text';

export type TrustTransportStreamParticipantCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

function toStreamUserId(userId: string): string {
  return `trust-transport-${userId}`;
}

// Delete a member's TrustTransport data on Stream when they delete their account. Trip thread chat is
// sent directly into Stream Chat under `trust-transport-<userId>`, so Stream keeps a copy a Postgres
// delete does not remove. Hard-deletes the member's Stream user with `mark_messages_deleted`.
// Best-effort: returns `false` (never throws) when Stream is unconfigured or the call fails, so the
// account-deletion hook that calls this can log and continue without blocking the deletion.
export async function deleteTrustTransportStreamData(userId: string): Promise<boolean> {
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
    reportError(error, { area: 'trust-transport', op: 'stream_delete_user', extra: { streamUserId: toStreamUserId(userId) } });
    return false;
  }
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

  // Server-side client authenticated with the API secret: it never calls connectUser, so there is no
  // websocket to tear down. disconnectUser() is a client-side teardown method and can throw on a
  // server instance — let the client go out of scope instead.
  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  const requesterStreamUserId = await upsertStreamUser(streamClient, input.requesterUserId);
  const providerStreamUserId = await upsertStreamUser(streamClient, input.providerUserId);

  const streamChannelId = `trust-transport-trip-${input.tripId}`;
  const channel = streamClient.channel('messaging', streamChannelId, {
    created_by_id: requesterStreamUserId,
    name: 'TrustTransport Trip Thread',
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

  await channel.addMembers([requesterStreamUserId, providerStreamUserId]);
  return streamChannelId;
}

export async function createTrustTransportParticipantToken(userId: string): Promise<TrustTransportStreamParticipantCredentials | null> {
  const config = await resolveStreamCredentials();
  if (!config) {
    return null;
  }

  // Same as above: server-side secret client, no connectUser, so no disconnectUser teardown needed.
  const streamClient = new StreamChat(config.apiKey, config.apiSecret);
  const streamUserId = await upsertStreamUser(streamClient, userId);

  return {
    streamApiKey: config.apiKey,
    streamUserId,
    streamToken: streamClient.createToken(streamUserId),
  };
}
