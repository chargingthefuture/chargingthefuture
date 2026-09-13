import type { FIRESIDE_REACTION_KINDS } from './constants';

export type FiresideReactionKind = (typeof FIRESIDE_REACTION_KINDS)[number];

export type FiresideCommentStatus = 'visible' | 'removed' | 'withdrawn';

/** The blog post a thread belongs to, as the address wiki-site mints its article URLs from. */
export type FiresidePostRef = {
  repo: string;
  slug: string;
};

export type FiresideThread = {
  id: string;
  postRepo: string;
  postSlug: string;
  postTitle: string;
  isClosed: boolean;
  commentCount: number;
};

/**
 * One comment as a reader sees it. `authorName` is a display name and never an email or a user id:
 * this shape is returned on a public, unauthenticated route, so anything on it is on the open web.
 */
export type FiresideComment = {
  id: string;
  parentCommentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  reactions: Record<FiresideReactionKind, number>;
  /** Which reactions the signed-in viewer has left. Empty for a signed-out reader. */
  viewerReactions: FiresideReactionKind[];
  /** True when the viewer wrote it, so their own screen can label its state. */
  isOwn: boolean;
};

/** The author's own view of a comment, including ones nobody else can see yet. */
export type FiresideOwnComment = FiresideComment & {
  state: 'live' | 'held_for_approval' | 'removed' | 'withdrawn';
  exportToBlog: boolean;
  postRepo: string;
  postSlug: string;
  postTitle: string;
};

export type FiresideCommentInput = {
  postRepo: string;
  postSlug: string;
  postTitle: string;
  parentCommentId: string | null;
  body: string;
};
