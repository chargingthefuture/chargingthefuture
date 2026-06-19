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

export type FeedCommunityDetail = {
  id: string;
  body: string;
  category: FeedCommunityCategory;
  authorUserId: string;
  authorUsername: string | null;
  replyCount: number;
  replies: FeedCommunityReply[];
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
};
