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

// What kind of feed item a Hub message came from. Drives how the client renders it: an
// `announcement` shows the distinct official card (badge + optional title), while `community`
// (peer posts) and `question` (AI Q&A) render as ordinary chat bubbles.
export type HubMessageKind = 'announcement' | 'question' | 'community';

// Hub-owned message types
export type HubMessage = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  // Which feed channel this message came from. `community` for peer posts (the common case),
  // `announcement` for official Survivor Hub posts, `question` for AI Q&A items.
  kind: HubMessageKind;
  // The announcement's own title, rendered as a heading above the body on the official card.
  // Null for peer posts and AI answers (their `text` is the whole message).
  title: string | null;
  // The plugin this announcement links to, resolved to { slug, name } — drives the clickable
  // "Open <Plugin>" chip on the official card. Null when the announcement has no (valid, visible)
  // linked plugin, and always null for peer posts and AI answers.
  linkedPlugin: { slug: string; name: string } | null;
  text: string;
  sentAtIso: string;
  // The underlying community post id (when this message is a peer post). This is the id a
  // reply must reference — distinct from `id`, which for a polled message is the feed item id.
  // Null for announcements / AI answers, which cannot be replied to as peer posts.
  communityPostId: string | null;
  // The underlying announcement id (when this message is an official announcement). This is the id
  // an announcement reaction/reply keys on — distinct from `id`, which for a polled message is the
  // feed item id. Null for peer posts and AI answers.
  announcementId: string | null;
  // The peer post this message quotes (Signal-style reply), or null when it is not a reply.
  quotedMessage: HubQuotedMessage | null;
  // Emoji reactions on this message, ordered by the fixed reaction set. Populated for peer posts
  // (their community post) and for announcements; always an array, empty when there are none.
  reactions: HubReactionSummary[];
  // The number of replies on this announcement (announcements only). 0 for peer posts and AI
  // answers, which are not replied to through the announcement thread.
  replyCount: number;
};

// One reply on an official announcement, returned by the announcement replies endpoint. `author`
// is the display handle resolved server-side (e.g. "@farah" or a stable pseudonym) so the thread
// renders without a second lookup. `isMine` marks the requesting member's own replies.
export type HubAnnouncementReply = {
  id: string;
  author: string;
  isMine: boolean;
  body: string;
  sentAtIso: string;
};

export type HubAnnouncementRepliesResponse = {
  ok: true;
  announcementId: string;
  replies: HubAnnouncementReply[];
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

// The credentials the Commons live layer needs to open a Stream Chat connection.
// `configured: true` carries a real key/token/channel minted server-side. `configured: false`
// means Stream is not set up in this environment (no API key/secret), so the client must skip the
// live connection and stay on polling — Commons never breaks when Stream is absent.
export type HubJoinResponse =
  | {
    ok: true;
    configured: true;
    streamApiKey: string;
    streamChannelId: string;
    streamUserId: string;
    streamToken: string;
  }
  | {
    ok: true;
    configured: false;
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
