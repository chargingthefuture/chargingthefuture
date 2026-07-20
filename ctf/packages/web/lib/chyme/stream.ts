import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';

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

async function ensureChannel(streamClient: StreamChat, streamUserId: string) {
  const channel = streamClient.channel('messaging', CHYME_STREAM_CHANNEL_ID, {
    created_by_id: streamUserId,
    name: 'Chyme Main Room',
  });

  try {
    await channel.create();
  } catch {
    await channel.watch();
  }

  await channel.addMembers([streamUserId]);
  return channel;
}

export async function createStreamJoinCredentials(
  userId: string,
  name: string,
): Promise<StreamJoinCredentials | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const streamUserId = await ensureMember(streamClient, userId, name);
    const channel = await ensureChannel(streamClient, streamUserId);

    return {
      streamApiKey: streamConfig.apiKey,
      streamChannelId: channel.id ?? CHYME_STREAM_CHANNEL_ID,
      streamUserId,
      streamToken: streamClient.createToken(streamUserId),
    };
  } finally {
    await streamClient.disconnectUser();
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
    await streamClient.disconnectUser();
  }
}

export async function sendChymeStreamMessage(input: {
  userId: string;
  name: string;
  text: string;
}): Promise<string | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const streamUserId = await ensureMember(streamClient, input.userId, input.name);
    const channel = await ensureChannel(streamClient, streamUserId);

    try {
      const result = await channel.sendMessage({
        text: input.text,
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

// Delete a member's Chyme data on the Stream side when they delete their Chyme service profile or
// their whole account. Every Chyme chat message is fanned out to Stream (see sendChymeStreamMessage),
// so Stream keeps an independent copy that the Postgres delete alone does not remove — leaving the
// member's message content on Stream indefinitely. This hard-deletes the member's Stream user
// (`chyme-<userId>`) and marks their messages deleted, closing that gap so the Stream copy goes when
// the Postgres copy goes.
//
// Best-effort by contract: it returns `false` (never throws) when Stream is unconfigured or the call
// fails, so a Stream outage can never block or roll back the user's deletion. The caller logs the
// outcome. Returns `true` when the delete was issued.
export async function deleteChymeStreamData(userId: string): Promise<boolean> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return false;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    await streamClient.deleteUser(toStreamUserId(userId), {
      // Remove the member's messages from the channel, not just the user record...
      mark_messages_deleted: true,
      // ...and hard-delete so nothing is retained on Stream (matches the Postgres hard delete).
      hard_delete: true,
    });
    return true;
  } catch {
    return false;
  } finally {
    await streamClient.disconnectUser();
  }
}
