import type {
  FIRESIDE_ALL_REACTION_KINDS,
  FIRESIDE_COUNTED_KINDS,
  FIRESIDE_REACTION_KINDS,
  FIRESIDE_VOTE_KINDS,
} from './constants';

export type FiresideReactionKind = (typeof FIRESIDE_REACTION_KINDS)[number];

/** Agree or disagree. Neither changes where a comment sits in the thread. */
export type FiresideVoteKind = (typeof FIRESIDE_VOTE_KINDS)[number];

/** Anything storable in `fireside_reactions.kind` — the three reactions and the two votes. */
export type FiresideAnyReactionKind = (typeof FIRESIDE_ALL_REACTION_KINDS)[number];

/**
 * The kinds that may appear in a count anybody is shown. `downvote` is not one of them and must
 * not become one: it is recorded, its own author sees it, and no total of it is returned.
 */
export type FiresideCountedKind = (typeof FIRESIDE_COUNTED_KINDS)[number];

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
  /**
   * How many people left each countable kind. There is no `downvote` key, by construction — see
   * FiresideCountedKind. Nothing reads these to decide order; the thread is oldest first.
   */
  reactions: Record<FiresideCountedKind, number>;
  /**
   * What the signed-in viewer has left on this comment, which may include their own downvote:
   * that is their own data, and the control has to be able to show as pressed. Empty for a
   * signed-out reader.
   */
  viewerReactions: FiresideAnyReactionKind[];
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

/**
 * One comment as the blog's published build receives it.
 *
 * Deliberately narrower than what a reader sees in the app: no reaction counts, no viewer state,
 * no user id. What ships here is copied into a static build that web archives capture, so the
 * shape carries only the words, who wrote them by display name, and which post they belong under.
 * Nothing on it can be withdrawn later, by anybody, which is why two people have to agree before a
 * comment reaches it.
 */
export type FiresideExportableComment = {
  commentId: string;
  parentCommentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  postRepo: string;
  postSlug: string;
  postTitle: string;
};
