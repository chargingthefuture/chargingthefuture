// Gated contributor channel — mobile API client (Contributor Access module).
// Mirrors the web routes under ctf/packages/web/app/api/contributor-access/channel/ and the shared
// constants in ctf/packages/web/lib/contributor-access/gated-channel-shared.ts (the mobile app has
// no import path into the web package, so the client copies the constants; the server validates
// against its own copy either way). All calls go through authedFetch so the Clerk bearer token is
// attached and the base URL comes from runtime config (APP_URL) — same pattern as the hub client.
//
// 404 posture (the no-teaser rule): a non-eligible member's request answers a bare 404
// indistinguishable from a route that does not exist. Every function here surfaces that as a
// silent "no access" result (null / false), never as an error — the caller simply renders
// nothing, with no banner and no retry loop.

import { authedFetch } from '../../auth/authedFetch';

const CHANNEL_API_BASE = '/api/contributor-access/channel';

// Slug and label the Hub channel list uses for this channel.
export const GATED_CHANNEL_SLUG = 'contributors';
export const GATED_CHANNEL_DISPLAY_NAME = '#contributors';

// Moderator read access is DISCLOSED in-channel (proposal hard requirement): this line renders in
// the channel header, always visible.
export const GATED_CHANNEL_MODERATOR_DISCLOSURE = 'Moderators can read this channel.';

// Longer messages than the Commons (its community-post cap is 1200).
export const GATED_MAX_MESSAGE_LENGTH = 4000;

// The gated channel's fixed twelve-emoji reaction set, in display order — richer than the Commons'
// six. The server rejects anything outside this set (400).
export const GATED_REACTION_EMOJIS = [
  '👍',
  '❤️',
  '😂',
  '🎉',
  '🙏',
  '😢',
  '💯',
  '🔥',
  '👏',
  '🤝',
  '💡',
  '🌱',
] as const;
export type GatedReactionEmoji = (typeof GATED_REACTION_EMOJIS)[number];

// An emoji reaction aggregate on a gated post. Mirrors the web GatedChannelReactionSummary.
export type GatedReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

// One message in the gated channel. Matches the web GatedChannelMessage
// (lib/contributor-access/channel-repository.ts).
export type GatedChannelMessage = {
  id: string;
  authorUserId: string;
  authorUsername: string | null;
  displayName: string;
  body: string;
  createdAtIso: string;
  // Signal-style quoted reply (author handle + short snippet), resolved server-side. Null when
  // the message is not a reply.
  quotedMessage: { author: string; snippet: string } | null;
  reactions: GatedReactionSummary[];
};

// GET /api/contributor-access/channel/messages — the channel history, oldest-first.
// Returns null on a 404 (no access — treat silently; the channel simply does not exist here).
export async function fetchGatedMessages(): Promise<GatedChannelMessage[] | null> {
  const res = await authedFetch(`${CHANNEL_API_BASE}/messages`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Unable to load channel messages: ${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; messages: GatedChannelMessage[] };
  return data.messages;
}

// POST /api/contributor-access/channel/messages — send a post (CSRF-guarded, like every mobile
// mutation). `replyToPostId` quotes another post (Signal-style reply); null for a top-level post.
// Returns null on a 404 (access lost — treat silently).
export async function sendGatedMessage(
  text: string,
  replyToPostId: string | null = null,
): Promise<GatedChannelMessage | null> {
  const res = await authedFetch(`${CHANNEL_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify(replyToPostId ? { text, replyToPostId } : { text }),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('You are posting too quickly. Wait a moment and try again.');
    }
    if (res.status === 422) {
      throw new Error('That post was held back by content moderation.');
    }
    throw new Error(`Unable to send message: ${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; message: GatedChannelMessage };
  return data.message;
}

// POST /api/contributor-access/channel/messages/[postId]/reactions — toggle the signed-in
// member's emoji reaction (a second tap of the same emoji removes it). The emoji must be in
// GATED_REACTION_EMOJIS or the server rejects (400). Returns null on a 404 (silent no-access).
export async function toggleGatedReaction(
  postId: string,
  emoji: GatedReactionEmoji,
): Promise<{ reacted: boolean } | null> {
  const res = await authedFetch(
    `${CHANNEL_API_BASE}/messages/${encodeURIComponent(postId)}/reactions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
      body: JSON.stringify({ emoji }),
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Unable to react: ${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; reacted: boolean };
  return { reacted: data.reacted };
}

// DELETE /api/contributor-access/channel/messages/[postId] — soft-delete the member's own post
// (author-only server-side; admins may remove any post — the disclosed moderator power). A 404
// (post already gone, or access lost) resolves silently, matching the channel's error posture.
export async function deleteGatedMessage(postId: string): Promise<void> {
  const res = await authedFetch(`${CHANNEL_API_BASE}/messages/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    headers: {
      'x-ctf-csrf': '1',
    },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('You can only delete your own posts.');
    }
    throw new Error(`Unable to delete post: ${res.status}`);
  }
}
