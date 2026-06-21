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

export type ChatMessage = {
  id: string;
  from: 'hub' | 'user';
  text: string;
  time: string;
  // Original ISO timestamp (when known) used to time-sort the unified stream; `time` is the
  // display-only formatted label. Optional because optimistic/synthetic messages may lack one.
  sentAtIso?: string;
  senderLabel?: string;
  actionLabel?: string;
  actionSlug?: string;
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
