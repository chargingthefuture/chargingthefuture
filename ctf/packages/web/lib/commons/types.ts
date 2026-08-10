// A compact reference to the peer post this Hub message quotes (Signal-style reply).
// Resolved server-side so the chat can render the quoted block (author + short snippet)
// without a second fetch. Null when the message is not a reply.
export type CommonsQuotedMessage = {
  author: string;
  snippet: string;
  // The quoted post's community post id, so the chat can jump to (scroll to) the original message
  // when a member taps the quote block. Null when the quoted post is no longer resolvable.
  postId: string | null;
};

// An emoji reaction aggregate on a Hub peer message (community post): the emoji, the count of
// members who reacted, and whether the requesting member is one of them. Only emojis with at
// least one reaction appear. Mirrors the feed FeedReactionSummary.
export type CommonsReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

// What kind of feed item a Hub message came from. Drives how the client renders it: an
// `announcement` shows the distinct official card (badge + optional title), while `community`
// (peer posts) and `question` (AI Q&A) render as ordinary chat bubbles.
export type CommonsMessageKind = 'announcement' | 'question' | 'community';

// Hub-owned message types
export type CommonsMessage = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  // Which feed channel this message came from. `community` for peer posts (the common case),
  // `announcement` for official operator posts, `question` for AI Q&A items.
  kind: CommonsMessageKind;
  // The announcement's own title, rendered as a heading above the body on the official card.
  // Null for peer posts and AI answers (their `text` is the whole message).
  title: string | null;
  // The plugins this announcement links to (0–3), resolved to { slug, name } — drives one clickable
  // "Open <Plugin>" chip per entry on the official card, in order. Empty when the announcement has no
  // (valid, visible) linked plugin, and always empty for peer posts and AI answers.
  linkedPlugins: Array<{ slug: string; name: string }>;
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
  quotedMessage: CommonsQuotedMessage | null;
  // Emoji reactions on this message, ordered by the fixed reaction set. Populated for peer posts
  // (their community post) and for announcements; always an array, empty when there are none.
  reactions: CommonsReactionSummary[];
  // The number of replies on this announcement (announcements only). 0 for peer posts and AI
  // answers, which are not replied to through the announcement thread.
  replyCount: number;
};

// One reply on an official announcement, returned by the announcement replies endpoint. `author`
// is the display handle resolved server-side (e.g. "@farah" or a stable pseudonym) so the thread
// renders without a second lookup. `isMine` marks the requesting member's own replies.
export type CommonsAnnouncementReply = {
  id: string;
  author: string;
  isMine: boolean;
  body: string;
  sentAtIso: string;
  // When the author last rewrote it, or null if they never did. The thread shows an "edited" mark
  // from this, so a reply whose words changed after it was posted does not read as the original.
  editedAtIso: string | null;
};

export type CommonsAnnouncementRepliesResponse = {
  ok: true;
  announcementId: string;
  replies: CommonsAnnouncementReply[];
};

export type CommonsMessagesResponse = {
  channelId: string;
  messages: CommonsMessage[];
};

// The member's last-seen marker for the Hub home channel, used to draw the "New messages"
// divider. `lastSeenAtIso` is null when the member has never been recorded.
export type CommonsLastSeenResponse = {
  ok: true;
  lastSeenAtIso: string | null;
};

// The credentials the Commons live layer needs to open a Stream Chat connection.
// `configured: true` carries a real key/token/channel minted server-side. `configured: false`
// means Stream is not set up in this environment (no API key/secret), so the client must skip the
// live connection and stay on polling — Commons never breaks when Stream is absent.
export type CommonsJoinResponse =
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

// Who a Hub channel is listed for. 'public' = every signed-in member; 'authenticated' reserved for a
// members-only channel; 'eligible' = the contributor-gated channel (Weavers of the Commons). The
// `role:${string}` arm keeps room for future role-scoped channels without collapsing the union to a
// bare `string` (which would silently accept any typo).
export type CommonsVisibilityScope = 'public' | 'authenticated' | 'eligible' | `role:${string}`;

export type CommonsChannelInfo = {
  slug: string;
  displayName: string;
  visibilityScope: CommonsVisibilityScope;
  streamChannelId: string;
};

export type CommonsChannelsResponse = {
  channels: CommonsChannelInfo[];
};
