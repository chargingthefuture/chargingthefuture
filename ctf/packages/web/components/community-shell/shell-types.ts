export type ShellSection = 'chat' | 'apps';

export type PluginSortMode = 'recent' | 'alpha' | 'most-used';

export type ShellStats = {
  memberCount: number | null;
  gdpValueUsd: number | null;
};

export type ShellCurrentUser = {
  userId: string;
  username: string | null;
  displayName: string;
  initial: string;
};

// A compact reference to the peer message this one quotes (Signal-style reply): the quoted
// author's handle and a short snippet of its body. Resolved server-side and rendered as a
// quoted block above the message body. Null/absent when the message is not a reply.
export type ChatQuotedMessage = {
  author: string;
  snippet: string;
};

// An emoji reaction aggregate on a peer message: the emoji, how many members reacted with it,
// and whether the current member is one of them. Only emojis with at least one reaction appear.
export type ChatReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

// What the message is, when it comes from the Hub. `announcement` renders the distinct official
// card; everything else renders as an ordinary chat bubble. Absent on synthetic/optimistic
// messages (empty-state prompt, concierge replies), which are treated as ordinary bubbles.
export type ChatMessageKind = 'announcement' | 'question' | 'community';

export type ChatMessage = {
  id: string;
  from: 'hub' | 'user';
  text: string;
  time: string;
  // Which feed channel this message came from (Hub messages only). Drives the official
  // announcement card; absent/`community` renders as a normal bubble.
  kind?: ChatMessageKind;
  // The announcement's heading, shown above the body on the official card. Absent otherwise.
  announcementTitle?: string | null;
  // The plugin an announcement links to ({ slug, name }), rendered as a clickable "Open <Plugin>"
  // chip on the official card. Absent/null for peer posts, AI answers, and announcements with no link.
  linkedPlugin?: { slug: string; name: string } | null;
  // Original ISO timestamp (when known) used to time-sort the unified stream; `time` is the
  // display-only formatted label. Optional because optimistic/synthetic messages may lack one.
  sentAtIso?: string;
  senderLabel?: string;
  actionLabel?: string;
  actionSlug?: string;
  // The underlying community post id, when this message is a peer post. This is the id a reply
  // must reference. Absent for AI answers, concierge replies, and the empty-state prompt.
  communityPostId?: string | null;
  // The underlying announcement id, when this message is an official announcement. The id its
  // reactions and replies key on. Absent for peer posts, AI answers, and synthetic messages.
  announcementId?: string | null;
  // The peer message this one quotes (Signal-style reply), or null/absent when not a reply.
  quotedMessage?: ChatQuotedMessage | null;
  // Emoji reactions on this message (peer post or announcement), ordered by the fixed reaction
  // set. Absent/empty for messages with no reactions.
  reactions?: ChatReactionSummary[];
  // The number of replies on this announcement (announcements only). Absent/0 otherwise.
  replyCount?: number;
};

export type ComicAnswerRating = 'helpful' | 'not_helpful' | 'flagged';

// A plugin link shown beneath a published answer: the registry slug (builds the /apps/<slug> route)
// and the display name (the chip label). Mirrors the server's ComicLinkedPlugin.
export type ComicLinkedPlugin = {
  slug: string;
  name: string;
};

// An AI Assistant (@comic) Q&A item rendered inline in the unified stream. `pending` items show
// the "Reviewing for safety" card and carry no answer text; `answered` items show the approved
// answer and a rating row. Mirrors the server's ComicAskerStreamItem.
export type ComicStreamItem = {
  questionTurnId: string;
  conversationId: string;
  status: 'pending' | 'answered';
  question: string;
  answer: string | null;
  answerTurnId: string | null;
  currentUserRating: ComicAnswerRating | null;
  // Applicable plugins the reviewer tagged on the answer, resolved to slug + display name. Empty
  // array when none. Rendered as tappable plugin links under the answer text.
  linkedPlugins: ComicLinkedPlugin[];
  askedAtIso: string;
  // Client-only flag for items optimistically added on submit, before the server stream catches up.
  optimistic?: boolean;
};
