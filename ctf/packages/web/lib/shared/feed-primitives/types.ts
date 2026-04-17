
export type FeedQuestionDetail = {
  questionId: string;
  authorUserId: string;
  title: string;
  body: string;
  createdAtIso: string;
  updatedAtIso: string;
  answerCount: number;
  upvotes: number;
  isAnswered: boolean;
};

export type FeedCommunityDetail = {
  postId: string;
  authorUserId: string;
  title: string;
  body: string;
  createdAtIso: string;
  updatedAtIso: string;
  commentCount: number;
  upvotes: number;
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
