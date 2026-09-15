import type { FIRESIDE_REACTION_KINDS } from './constants';

export type FiresideReactionKind = (typeof FIRESIDE_REACTION_KINDS)[number];

export type FiresideCommentStatus = 'visible' | 'removed' | 'withdrawn';

/**
 * Where a comment stands on being copied into the blog's published build.
 *
 * 'not_requested' — the author has not asked. The starting state and the state an author returns it
 *   to by switching the request off.
 * 'pending'       — the author asked; an admin has not looked yet.
 * 'approved'      — an admin agreed. Only this state, and only alongside the author's own opt-in,
 *   lets a comment out of the app.
 * 'refused'       — an admin declined it, and it stays declined. Switching the request back on does
 *   not re-open it, because a refusal that can be re-queued is not a refusal.
 */
export type ExportReview = 'not_requested' | 'pending' | 'approved' | 'refused';

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
  exportReview: ExportReview;
  /** What an admin said when they declined it, shown to the author as written. */
  exportRefusalReason: string | null;
  /**
   * What the author wrote, kept for them after they take a comment down, and null otherwise.
   *
   * Only ever on this shape — the author's own view of their own rows. The public comment type
   * above has no such field, so there is nowhere for it to be returned to anybody else.
   */
  withdrawnBody: string | null;
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

/** One pending export request, as the admin queue shows it. */
export type FiresideExportRequest = {
  commentId: string;
  body: string;
  authorUserId: string;
  authorName: string;
  postRepo: string;
  postSlug: string;
  postTitle: string;
  requestedAt: string;
  /** The author's record here, so a repeated offender is answered as an account, not an item. */
  authorRecord: FiresideAuthorRecord;
};

/**
 * What this account has done in Fireside, counted. It exists so an admin looking at one bad request
 * can see whether it is the first or the fifth: several refusals or removals against one account is
 * a question about the account, which is settled once, rather than item by item forever.
 */
export type FiresideAuthorRecord = {
  comments: number;
  removed: number;
  exportsRefused: number;
  exportsApproved: number;
};
