// Survivor Hub home channel (mobile). Mirrors the web routes under
// ctf/packages/web/app/api/hub/messages: one blended, feed-backed `community` channel
// interleaving admin announcements, AI Q&A answers, and peer-to-peer community posts.
// Reads via GET /api/hub/messages; sending creates a peer-to-peer community post via
// POST /api/hub/messages (CSRF-guarded with the x-ctf-csrf header, same as the feed client).
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

export const HUB_API_BASE = '/api/hub';

// The fixed quick set of emoji reactions, in display order. Mirrors the web FEED_REACTION_EMOJIS;
// the server rejects anything outside this set (400).
export const HUB_REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '😢'] as const;
export type HubReactionEmoji = (typeof HUB_REACTION_EMOJIS)[number];

// An emoji reaction aggregate on a Hub peer post: the emoji, how many members reacted with it, and
// whether the signed-in member is one of them. Mirrors the web HubReactionSummary.
export type HubReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

// One message in the blended Hub stream. Matches lib/hub/types HubMessage on the web side.
// `displayName` is "Survivor Hub" for announcements and AI Q&A, "Community member" for peer posts.
export type HubMessage = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  text: string;
  sentAtIso: string;
  // The underlying community post id when this message is a peer post (the id the reactions route
  // takes); null for announcements / AI answers, which cannot be reacted to.
  communityPostId: string | null;
  // Emoji reactions on this message's community post, ordered by the fixed set. Always an array;
  // empty for non-peer messages and posts with no reactions.
  reactions: HubReactionSummary[];
};

export type HubMessagesResponse = {
  channelId: string;
  messages: HubMessage[];
};

// The server returns the blended stream oldest-first (ready for a chat view).
export async function fetchHubMessages(): Promise<HubMessagesResponse> {
  const res = await authedFetch(`${HUB_API_BASE}/messages`);
  if (!res.ok) {
    throw new Error(`Hub messages request failed: ${res.status}`);
  }
  const data = (await res.json()) as HubMessagesResponse;
  return data;
}

export type HubSendResult = {
  ok: true;
  message: HubMessage;
};

// Sending from the composer creates a peer-to-peer community post. Mirrors the web POST contract:
// the x-ctf-csrf header is required, and the server normalizes the new post to the same public
// author shape the polled copy uses so the optimistic send and the polled copy dedup cleanly.
export async function sendHubMessage(text: string): Promise<HubSendResult> {
  const res = await authedFetch(`${HUB_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('You are posting too quickly. Wait a moment and try again.');
    }
    if (res.status === 422) {
      throw new Error('That post was held back by content moderation.');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('Sign in to post to the community.');
    }
    throw new Error(`Unable to send message: ${res.status}`);
  }

  return (await res.json()) as HubSendResult;
}

// Toggle the signed-in member's emoji reaction on a Hub peer post. A second tap of the same emoji
// removes it. Mirrors POST /api/hub/messages/[postId]/reactions; returns whether the reaction is now
// on (`reacted: true`) or off. The emoji must be in HUB_REACTION_EMOJIS or the server rejects (400).
export async function toggleHubReaction(
  postId: string,
  emoji: HubReactionEmoji,
): Promise<{ reacted: boolean }> {
  const res = await authedFetch(`${HUB_API_BASE}/messages/${encodeURIComponent(postId)}/reactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Sign in to react to community posts.');
    }
    throw new Error(`Unable to react: ${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; reacted: boolean };
  return { reacted: data.reacted };
}
