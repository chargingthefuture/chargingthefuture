// A compact reference to the peer post this Hub message quotes (Signal-style reply).
// Resolved server-side so the chat can render the quoted block (author + short snippet)
// without a second fetch. Null when the message is not a reply.
export type HubQuotedMessage = {
  author: string;
  snippet: string;
};

// An emoji reaction aggregate on a Hub peer message (community post): the emoji, the count of
// members who reacted, and whether the requesting member is one of them. Only emojis with at
// least one reaction appear. Mirrors the feed FeedReactionSummary.
export type HubReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

// Hub-owned message types
export type HubMessage = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  text: string;
  sentAtIso: string;
  // The underlying community post id (when this message is a peer post). This is the id a
  // reply must reference — distinct from `id`, which for a polled message is the feed item id.
  // Null for announcements / AI answers, which cannot be replied to as peer posts.
  communityPostId: string | null;
  // The peer post this message quotes (Signal-style reply), or null when it is not a reply.
  quotedMessage: HubQuotedMessage | null;
  // Emoji reactions on this message's underlying community post, ordered by the fixed reaction
  // set. Always an array; empty for non-community messages and posts with no reactions.
  reactions: HubReactionSummary[];
};

export type HubMessagesResponse = {
  channelId: string;
  messages: HubMessage[];
};

// The member's last-seen marker for the Hub home channel, used to draw the "New messages"
// divider. `lastSeenAtIso` is null when the member has never been recorded.
export type HubLastSeenResponse = {
  ok: true;
  lastSeenAtIso: string | null;
};

export type HubJoinResponse = {
  ok: true;
  streamApiKey: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

export type HubChannelInfo = {
  slug: string;
  displayName: string;
  visibilityScope: 'public' | 'authenticated' | string; // role:* patterns supported
  streamChannelId: string;
};

export type HubChannelsResponse = {
  channels: HubChannelInfo[];
};

export type HubBotInfo = {
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  personaBlurb: string;
  isActive: boolean;
};

export type HubBotsResponse = {
  bots: HubBotInfo[];
};
