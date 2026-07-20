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

// A compact reference to the peer post this message quotes (Signal-style reply), resolved
// server-side so the chat can render the quoted block without a second fetch. Mirrors the web
// HubQuotedMessage. Null when the message is not a reply.
export type HubQuotedMessage = {
  author: string;
  snippet: string;
  // The quoted post's id, sent by the server so a tap can jump to the original message. The web
  // chat uses it today; the Android tap-to-jump is a tracked parity follow-up.
  postId?: string | null;
};

// One message in the blended Hub stream. Matches lib/hub/types HubMessage on the web side.
// `displayName` is "Survivor Hub" for announcements and AI Q&A, "Community member" for peer posts.
export type HubMessage = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  // Which feed channel this message came from: `announcement` (official post), `question` (AI Q&A),
  // or `community` (peer post). Drives the official announcement title treatment on the card.
  kind: 'announcement' | 'question' | 'community';
  // The announcement's heading, rendered above the body. Null for peer posts and AI answers, whose
  // `text` is the whole message. (The web API splits the title out of the body server-side.)
  title: string | null;
  // The plugin an announcement links to ({ slug, name }), rendered as a tappable "Open <Plugin>"
  // chip. Null for peer posts, AI answers, and announcements with no (valid, visible) linked plugin.
  linkedPlugin: { slug: string; name: string } | null;
  text: string;
  sentAtIso: string;
  // The underlying community post id when this message is a peer post (the id the reactions and
  // reply routes take); null for announcements / AI answers, which cannot be reacted/replied to.
  communityPostId: string | null;
  // The peer post this message quotes (Signal-style reply), or null when it is not a reply.
  quotedMessage: HubQuotedMessage | null;
  // Emoji reactions on this message's community post, ordered by the fixed set. Always an array;
  // empty for non-peer messages and posts with no reactions.
  reactions: HubReactionSummary[];
};

export type HubMessagesResponse = {
  channelId: string;
  messages: HubMessage[];
};

// The stream filter the Hub home can apply. 'mentions' adds `?mentions=me` (only peer messages
// whose body @-mentions the caller); 'announcements' adds `?channel=announcements` (only official
// announcements). Both are resolved server-side beyond the loaded page — the same filters behind
// the web Commons "@ Mentions" and 📣 chips. 'all' is the unfiltered blended stream.
export type HubStreamFilter = 'all' | 'mentions' | 'announcements';

// The server returns the blended stream oldest-first (ready for a chat view).
export async function fetchHubMessages(filter: HubStreamFilter = 'all'): Promise<HubMessagesResponse> {
  const query = filter === 'mentions' ? '?mentions=me' : filter === 'announcements' ? '?channel=announcements' : '';
  const res = await authedFetch(`${HUB_API_BASE}/messages${query}`);
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
// `replyToPostId` quotes another peer post (Signal-style reply); null for a top-level post.
export async function sendHubMessage(
  text: string,
  replyToPostId: string | null = null,
): Promise<HubSendResult> {
  const res = await authedFetch(`${HUB_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ text, replyToPostId }),
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

// Delete the member's own peer post. The product has no edit — to change a post you delete and
// repost — so this removes it outright. Author-only is enforced server-side (403 for anyone else).
export async function deleteHubMessage(postId: string): Promise<void> {
  const res = await authedFetch(`${HUB_API_BASE}/messages/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    headers: {
      'x-ctf-csrf': '1',
    },
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('You can only delete your own posts.');
    }
    if (res.status === 404) {
      throw new Error('That post is no longer available.');
    }
    throw new Error(`Unable to delete post: ${res.status}`);
  }
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

// One entry in the Hub channel list. Mirrors the web HubChannelInfo (lib/hub/types).
export type HubChannelInfo = {
  slug: string;
  displayName: string;
  visibilityScope: string;
  streamChannelId: string;
};

// GET /api/hub/channels — the channels this member can see. The server filters by eligibility
// (the gated `contributors` entry appears ONLY for eligible members and admins), so the client
// never carries gating logic: when the entry is absent, no channel switch renders at all.
// Best-effort: any failure resolves to just the always-present general channel view (empty list),
// so the Commons is never blocked by this read.
export async function fetchHubChannels(): Promise<HubChannelInfo[]> {
  try {
    const res = await authedFetch(`${HUB_API_BASE}/channels`);
    if (!res.ok) return [];
    const data = (await res.json()) as { channels?: HubChannelInfo[] };
    return data.channels ?? [];
  } catch {
    return [];
  }
}

// The member's last-seen marker for the Hub home channel, used to draw the "New messages" divider.
// Best-effort: returns null on any failure (the divider simply does not show).
export async function fetchHubLastSeen(): Promise<string | null> {
  try {
    const res = await authedFetch(`${HUB_API_BASE}/last-seen`);
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; lastSeenAtIso?: string | null };
    return data.lastSeenAtIso ?? null;
  } catch {
    return null;
  }
}

// Move the member's last-seen marker forward (defaults to NOW server-side). Best-effort; a failure
// is ignored so the chat never breaks. The server clamps to NOW() and never moves it backwards.
export async function markHubSeen(): Promise<void> {
  try {
    await authedFetch(`${HUB_API_BASE}/last-seen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
      body: JSON.stringify({}),
    });
  } catch {
    // ignore — the divider is best-effort
  }
}
