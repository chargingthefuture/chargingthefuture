export type FeedRenderMode = 'card_only' | 'card_toast';

export type FeedChannel = 'all' | 'announcements' | 'questions' | 'community';

export type FeedEnabledChannel = Exclude<FeedChannel, 'all'>;

export type FeedQuestionCategory = 'housing' | 'services' | 'general' | 'safety' | 'benefits';

export type FeedCommunityCategory = 'general' | 'peer_support' | 'resource_share' | 'event';

export type FeedAnswerRatingValue = 'helpful' | 'not_helpful' | 'flagged';

export type FeedLocationContext = {
  zipCode: string;
  radiusMiles: number | null;
};

export type FeedAnswerSource = {
  id: string;
  label: string;
  detail: string;
};

export type FeedAnswer = {
  id: string;
  questionId: string;
  answerType: 'llm' | 'community';
  body: string;
  confidence: number | null;
  modelId: string | null;
  sources: FeedAnswerSource[];
  authorUserId: string | null;
  ratingSummary: Record<FeedAnswerRatingValue, number>;
  currentUserRating: FeedAnswerRatingValue | null;
  createdAtIso: string;
};

export type FeedQuestionDetail = {
  id: string;
  body: string;
  category: FeedQuestionCategory;
  location: FeedLocationContext | null;
  llmConsentGranted: boolean;
  answerCount: number;
  answers: FeedAnswer[];
};

export type FeedCommunityReply = {
  id: string;
  postId: string;
  body: string;
  authorUserId: string;
  createdAtIso: string;
};

// A compact reference to the peer post this one quotes (Signal-style reply). Resolved
// server-side to the quoted post's author handle and a short snippet of its body so the
// client can render the quoted block without a second fetch. Null when nothing is quoted
// or the quoted post was deleted (the foreign key is ON DELETE SET NULL).
export type FeedQuotedPost = {
  author: string;
  snippet: string;
};

// An aggregate of one emoji's reactions on a community post: the emoji, how many members
// reacted with it, and whether the requesting member is one of them. Only emojis with at least
// one reaction appear; the array is ordered by the fixed reaction set (FEED_REACTION_EMOJIS).
export type FeedReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type FeedCommunityDetail = {
  id: string;
  body: string;
  category: FeedCommunityCategory;
  authorUserId: string;
  authorUsername: string | null;
  replyCount: number;
  replies: FeedCommunityReply[];
  // The post this one replies to (Signal-style quote), or null when it is not a reply.
  replyToPostId: string | null;
  quotedPost: FeedQuotedPost | null;
  // Emoji reactions on this post, one entry per reacted emoji, ordered by the fixed reaction
  // set. Always an array (never null); empty when the post has no reactions.
  reactions: FeedReactionSummary[];
};

// The read-only shape shown to signed-out visitors on the public Commons. Community (peer) posts are
// public the way Quora posts are, so a not-signed-in visitor can read them — but nothing identifying
// beyond the author's chosen @username, and no replies/compose. Deliberately omits author_user_id.
export type PublicCommunityPost = {
  id: string;
  authorUsername: string | null;
  body: string;
  category: FeedCommunityCategory;
  createdAtIso: string;
};

export type FeedPagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type FeedTimelineItem = {
  id: string;
  itemType: 'announcement' | 'question' | 'community';
  sourceAnnouncementId: string | null;
  sourceQuestionId: string | null;
  sourceCommunityPostId: string | null;
  title: string;
  body: string;
  priority: number;
  mandatory: boolean;
  publishedAtIso: string;
  expiresAtIso: string | null;
  isRead: boolean;
  isDismissed: boolean;
  question: FeedQuestionDetail | null;
  community: FeedCommunityDetail | null;
};

export type FeedConfig = {
  renderMode: FeedRenderMode;
  maxTimelinePageSize: number;
  enabledChannels: FeedEnabledChannel[];
  isPublic: boolean;
  updatedByUserId: string;
  updatedAtIso: string;
};

export type FeedConfigInput = {
  renderMode: FeedRenderMode;
  maxTimelinePageSize: number;
  enabledChannels?: FeedEnabledChannel[];
};

export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export type AnnouncementTargeting = {
  roles?: string[];
  plugins?: string[];
  regions?: string[];
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  priority: number;
  mandatory: boolean;
  scheduleAtIso: string | null;
  publishedAtIso: string | null;
  expiresAtIso: string | null;
  targeting: AnnouncementTargeting;
  // Optional plugin this announcement points at (slug, e.g. "socket-relay"). When set, the published
  // feed item carries an "Open <Plugin>" link to /apps/<slug> so a reader can jump straight to it.
  linkedPluginSlug: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type AnnouncementDraftInput = {
  title: string;
  body: string;
  priority?: number;
  mandatory?: boolean;
  scheduleAtIso?: string | null;
  expiresAtIso?: string | null;
  targeting?: AnnouncementTargeting;
  // Slug of the plugin to link, or null/empty for none. Validated against the visible plugin
  // registry server-side; an unknown or admin-only slug is stored as null.
  linkedPluginSlug?: string | null;
};

export type MembershipEventType = 'join' | 'leave';

export type FeedQuestionInput = {
  body: string;
  category?: FeedQuestionCategory;
  location?: FeedLocationContext | null;
  consentGranted: boolean;
};

export type FeedCommunityPostInput = {
  body: string;
  category?: FeedCommunityCategory;
  // Optional id of the peer post this one quotes (Signal-style reply). Validated server-side
  // to reference an existing post; ignored when absent.
  replyToPostId?: string | null;
};
