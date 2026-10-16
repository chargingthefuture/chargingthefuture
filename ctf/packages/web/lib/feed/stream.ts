import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { streamChannelSetupFailure, isStreamNotFoundError } from 'lib/shared/stream-error-text';

export type FeedStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

// The one Feed channel anything connects to: the Commons home chat (ctf-feed-community), used for its
// typing indicator. No message is posted to it; the Commons reads its messages from Postgres. The
// announcements and questions channels, and the routes that handed out their credentials, had no
// caller and were removed (2026-10-16, issue #2732 follow-up).
const FEED_COMMUNITY_CHANNEL = { id: 'ctf-feed-community', name: 'CTF Feed Community' };

export async function getFeedStreamCredentials(
  userId: string,
  displayName: string,
): Promise<FeedStreamCredentials | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) return null;
  // Server-side client (apiKey + apiSecret): it issues tokens and makes REST calls, it never opens a
  // user WebSocket, so there is nothing to tear down. disconnectUser() is the client-side teardown for
  // a connected user and does not apply here — calling it in a finally only risked masking a real error.
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  const streamUserId = `feed-${userId}`;
  await streamClient.upsertUser({ id: streamUserId, name: displayName });
  const token = streamClient.createToken(streamUserId);
  const channelDef = FEED_COMMUNITY_CHANNEL;
  const channelId = channelDef.id;
  const channel = streamClient.channel('messaging', channelId, {
    created_by_id: streamUserId,
    name: channelDef.name,
  });
  try {
    await channel.create();
  } catch (createErr) {
    // A failed create usually means the channel already exists, and watching it is then the answer.
    reportError(createErr, { area: 'feed', op: 'channel_create', extra: { streamChannelId: channelId } });
    try {
      await channel.watch();
    } catch (watchErr) {
      throw new Error(streamChannelSetupFailure(channelId, createErr, watchErr));
    }
  }
  await channel.addMembers([streamUserId]);
  return {
    streamApiKey: streamConfig.apiKey,
    streamToken: token,
    streamUserId,
    streamChannelId: channelId,
  };
}

// Account or Commons deletion: remove the member's `feed-<userId>` Stream user, which carries their
// @username as its name and their Commons (and contributor channel) memberships. The Commons writes
// no chat messages under this identity, so the user record and memberships are all there is; a later
// Commons visit simply creates a fresh one. Returns false when Stream is unconfigured or the delete
// failed (reported), never throws — the external-cleanup registry turns false into a logged failure.
export async function deleteFeedStreamData(userId: string): Promise<boolean> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) return false;
  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  const streamUserId = `feed-${userId}`;
  try {
    await streamClient.deleteUser(streamUserId, { mark_messages_deleted: true, hard_delete: true });
    return true;
  } catch (error) {
    // A Stream user that does not exist has nothing to delete.
    if (isStreamNotFoundError(error)) {
      return true;
    }
    reportError(error, { area: 'feed', op: 'stream_delete_user', extra: { streamUserId } });
    return false;
  }
}
