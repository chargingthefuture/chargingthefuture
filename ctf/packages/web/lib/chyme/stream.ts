import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { streamChannelSetupFailure, streamFailureMessage } from 'lib/shared/stream-error-text';

export const CHYME_STREAM_CHANNEL_ID = 'chyme-main-room';

export type StreamJoinCredentials = {
  streamApiKey: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

function toStreamUserId(userId: string): string {
  return `chyme-${userId}`;
}

async function ensureMember(streamClient: StreamChat, userId: string, name: string): Promise<string> {
  const streamUserId = toStreamUserId(userId);
  await streamClient.upsertUser({
    id: streamUserId,
    name,
  });
  return streamUserId;
}

// The Stream chat channel id equals the room key, so each Chyme room (the open main room and the
// private Weavers room) has its own distinct Stream channel. Defaults to the main room for callers
// that don't pass one.
async function ensureChannel(
  streamClient: StreamChat,
  streamUserId: string,
  channelId: string = CHYME_STREAM_CHANNEL_ID,
) {
  const channel = streamClient.channel('messaging', channelId, {
    created_by_id: streamUserId,
  });

  try {
    await channel.create();
  } catch (createError) {
    // A failed create usually means the channel already exists, and watching it is then the answer.
    // The create error is kept so that, when the watch fails too, the thrown reason names both
    // failures instead of only the second one.
    try {
      await channel.watch();
    } catch (watchError) {
      throw new Error(streamChannelSetupFailure(channelId, createError, watchError));
    }
  }

  await channel.addMembers([streamUserId]);
  return channel;
}

// The server-side client holds no socket, so disconnecting is bookkeeping; a failure there must
// never replace the credentials being returned from the surrounding `finally`, only be recorded.
async function disconnectQuietly(streamClient: StreamChat, op: string): Promise<void> {
  try {
    await streamClient.disconnectUser();
  } catch (error) {
    reportError(error, { area: 'chyme', op });
  }
}

export async function createStreamJoinCredentials(
  userId: string,
  name: string,
  channelId: string = CHYME_STREAM_CHANNEL_ID,
): Promise<StreamJoinCredentials | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const streamUserId = await ensureMember(streamClient, userId, name);
    const channel = await ensureChannel(streamClient, streamUserId, channelId);

    return {
      streamApiKey: streamConfig.apiKey,
      streamChannelId: channel.id ?? channelId,
      streamUserId,
      streamToken: streamClient.createToken(streamUserId),
    };
  } finally {
    await disconnectQuietly(streamClient, 'join_credentials_disconnect');
  }
}

// Mint a short-lived Stream identity for an anonymous guest so they can LISTEN to the public room.
// The guest is an ephemeral Stream user (random id), not a member — they get a token that lets them
// join the call and receive audio. They never publish.
//
// Listen-only is enforced in two layers:
//  1. Client: the guest joins muted with camera/microphone disabled and no speak controls.
//  2. Server (Stream): when CHYME_GUEST_STREAM_ROLE is set, the guest Stream user is given that role,
//     and the owner has configured the `default` Video call type so that role lacks the publish
//     capabilities (send-audio / send-video / screenshare) while keeping join/read/subscribe. A guest
//     who extracts their token and calls join() directly then still cannot publish, because Stream
//     rejects publish for a role without the grant. See
//     `ctf/docs/plugins/chyme/guest-listener-stream-role.md` for the one-time Stream config.
//
// The env var gates this so the change is a no-op until the Stream role + call-type grants exist:
// unset → guests keep the default role (client-only enforcement, unchanged); set → server-enforced.
export async function createChymeGuestListenCredentials(): Promise<StreamJoinCredentials | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const guestUserId = `chyme-guest-${crypto.randomUUID()}`;
    const guestRole = process.env.CHYME_GUEST_STREAM_ROLE?.trim();
    await streamClient.upsertUser({
      id: guestUserId,
      name: 'Guest listener',
      ...(guestRole ? { role: guestRole } : {}),
    });
    // This token is handed to anonymous visitors from a public endpoint, so it must expire — an
    // indefinite token would leave a wide replay/abuse window. One hour is plenty to join and listen;
    // the page re-fetches a fresh token on reload.
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    return {
      streamApiKey: streamConfig.apiKey,
      streamChannelId: CHYME_STREAM_CHANNEL_ID,
      streamUserId: guestUserId,
      streamToken: streamClient.createToken(guestUserId, expiresAt),
    };
  } finally {
    await disconnectQuietly(streamClient, 'guest_credentials_disconnect');
  }
}

// Mint a Stream Video token for one participant of a Back Channel 1:1 call (spec #1746). Reuses the
// member's existing Chyme Stream identity (`chyme-<userId>`) so no extra user is created, but the call
// itself is a distinct 1:1 Video call (id `back-channel-<callId>`, the `default` call type, audio-only)
// separate from the main room. Both members mint their own token against the same call id and join it.
// Returns null only when Stream is not configured, so the route can answer "not configured". When
// Stream is configured but rejects the call, this throws with Stream's reason: a rejected token used to
// come back as null too, and the member then read "Stream service is not configured" for an outage,
// an expired key, or a bad user id alike, which sent the owner looking at the wrong thing.
export async function createChymeBackChannelCredentials(input: {
  userId: string;
  name: string;
  callId: string;
}): Promise<{ streamApiKey: string; streamUserId: string; streamToken: string; streamCallId: string } | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const streamUserId = await ensureMember(streamClient, input.userId, input.name);
    return {
      streamApiKey: streamConfig.apiKey,
      streamUserId,
      streamToken: streamClient.createToken(streamUserId),
      streamCallId: `back-channel-${input.callId}`,
    };
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'back_channel_token', extra: { callId: input.callId } });
    throw new Error(streamFailureMessage('Stream rejected the Back Channel token', error));
  } finally {
    await disconnectQuietly(streamClient, 'back_channel_token_disconnect');
  }
}

export async function sendChymeStreamMessage(input: {
  userId: string;
  name: string;
  text: string;
  // The Stream channel id (= room key) to fan out into; defaults to the main room's channel.
  channelId?: string;
}): Promise<string | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const streamUserId = await ensureMember(streamClient, input.userId, input.name);
    const channel = await ensureChannel(streamClient, streamUserId, input.channelId ?? CHYME_STREAM_CHANNEL_ID);

    try {
      const result = await channel.sendMessage({
        text: input.text,
        user_id: streamUserId,
      });

      return result.message?.id ?? null;
    } catch (error) {
      // The message is already stored in Postgres; the Stream copy is a fan-out. A failed fan-out is
      // recorded with the channel it was meant for, then swallowed so the member's send still succeeds.
      reportError(error, {
        area: 'chyme',
        op: 'stream_fanout_send',
        extra: { streamChannelId: input.channelId ?? CHYME_STREAM_CHANNEL_ID, streamUserId },
      });
      return null;
    }
  } finally {
    await disconnectQuietly(streamClient, 'fanout_send_disconnect');
  }
}

// Delete a member's Chyme data on the Stream side when they delete their Chyme profile or account.
// Chyme chat messages are fanned out to Stream (sendChymeStreamMessage), so Stream keeps an
// independent copy that the Postgres delete alone does not remove — leaving the member's message
// content on Stream indefinitely. This hard-deletes the member's Stream user (`chyme-<userId>`) and
// marks their messages deleted. Best-effort: returns `false` (never throws) when Stream is
// unconfigured or the call fails, so a Stream outage can never block or roll back the user's deletion.
export async function deleteChymeStreamData(userId: string): Promise<boolean> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return false;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    await streamClient.deleteUser(toStreamUserId(userId), {
      mark_messages_deleted: true,
      hard_delete: true,
    });
    return true;
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'stream_delete_user', extra: { streamUserId: toStreamUserId(userId) } });
    return false;
  } finally {
    await disconnectQuietly(streamClient, 'delete_user_disconnect');
  }
}
