// Fireside data access. Postgres rather than a chat backend, on purpose: comments on posts are
// low-volume and asynchronous, and what they have to be is durable, searchable, anchorable and
// exportable into a static build. A chat product priced on monthly active users gives none of
// those and adds a ceiling, and this repository already carries a CI gate about that quota.

import { randomUUID } from 'node:crypto';
import { queryDb } from 'lib/db/postgres';
// Through the platform interface, never lib/unlock directly — plugins stay isolated (rule 112,
// enforced by check-plugin-boundaries.mjs).
import { listUnlockedUserIds } from 'lib/shared/unlock-interface';
import {
  FIRESIDE_MAX_COMMENTS_PER_DAY,
  FIRESIDE_MAX_COMMENT_LENGTH,
  FIRESIDE_MIN_COMMENT_LENGTH,
  FIRESIDE_REACTION_KINDS,
} from './constants';
import type {
  ExportReview,
  FiresideComment,
  FiresideCommentInput,
  FiresideCommentStatus,
  FiresideOwnComment,
  FiresidePostRef,
  FiresideReactionKind,
  FiresideThread,
} from './types';
import { commentStateForAuthor, isPubliclyVisible } from './visibility';

export async function insertFiresideAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  result?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await queryDb(
    `INSERT INTO fireside_audit_events
       (id, actor_id, command, policy_status, reason, target_type, target_id, result, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      randomUUID(),
      input.actorId,
      input.command,
      input.policyStatus,
      input.reason,
      input.targetType,
      input.targetId,
      input.result ?? '',
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

/** Why a comment was refused, in a word the route turns into a sentence. */
export type CommentRefusal =
  | 'body_too_short'
  | 'body_too_long'
  | 'thread_closed'
  | 'parent_not_found'
  | 'reply_depth_exceeded'
  | 'daily_limit_reached';

export function describeCommentBody(body: string): CommentRefusal | null {
  const trimmed = body.trim();
  if (trimmed.length < FIRESIDE_MIN_COMMENT_LENGTH) return 'body_too_short';
  if (trimmed.length > FIRESIDE_MAX_COMMENT_LENGTH) return 'body_too_long';
  return null;
}

type ThreadRow = {
  id: string;
  post_repo: string;
  post_slug: string;
  post_title: string;
  is_closed: boolean;
  comment_count: string | null;
};

function mapThread(row: ThreadRow): FiresideThread {
  return {
    id: row.id,
    postRepo: row.post_repo,
    postSlug: row.post_slug,
    postTitle: row.post_title,
    isClosed: row.is_closed,
    commentCount: Number(row.comment_count ?? '0'),
  };
}

/**
 * The thread for a post, created on first use. Threads are made lazily rather than seeded for every
 * post, because the blog holds hundreds of pages and most will never be commented on; a row per
 * post would be a table of empty rows to page through in the admin panel.
 */
export async function getOrCreateThread(post: FiresidePostRef, title: string): Promise<FiresideThread> {
  await queryDb(
    `INSERT INTO fireside_threads (id, post_repo, post_slug, post_title)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (post_repo, post_slug) DO NOTHING`,
    [randomUUID(), post.repo, post.slug, title],
  );
  const found = await findThread(post);
  if (!found) throw new Error('fireside_thread_missing_after_insert');
  return found;
}

export async function findThread(post: FiresidePostRef): Promise<FiresideThread | null> {
  const result = await queryDb<ThreadRow>(
    `SELECT t.id::text AS id, t.post_repo, t.post_slug, t.post_title, t.is_closed,
            (SELECT COUNT(*) FROM fireside_comments c WHERE c.thread_id = t.id AND c.status = 'visible') AS comment_count
       FROM fireside_threads t
      WHERE t.post_repo = $1 AND t.post_slug = $2
      LIMIT 1`,
    [post.repo, post.slug],
  );
  const row = result.rows[0];
  return row ? mapThread(row) : null;
}

type CommentRow = {
  id: string;
  parent_comment_id: string | null;
  author_user_id: string;
  author_username: string | null;
  body: string;
  status: FiresideCommentStatus;
  export_to_blog: boolean;
  export_review: ExportReview;
  export_refusal_reason: string | null;
  created_at: string;
  post_repo: string;
  post_slug: string;
  post_title: string;
};

function emptyReactionCounts(): Record<FiresideReactionKind, number> {
  return { recognize: 0, helpful: 0, same_here: 0 };
}

async function readReactions(commentIds: string[], viewerUserId: string | null): Promise<{
  counts: Map<string, Record<FiresideReactionKind, number>>;
  viewer: Map<string, FiresideReactionKind[]>;
}> {
  const counts = new Map<string, Record<FiresideReactionKind, number>>();
  const viewer = new Map<string, FiresideReactionKind[]>();
  if (commentIds.length === 0) return { counts, viewer };

  const result = await queryDb<{ comment_id: string; kind: FiresideReactionKind; reactor_user_id: string }>(
    `SELECT comment_id::text AS comment_id, kind, reactor_user_id
       FROM fireside_reactions
      WHERE comment_id = ANY($1::uuid[])`,
    [commentIds],
  );

  for (const row of result.rows) {
    if (!FIRESIDE_REACTION_KINDS.includes(row.kind)) continue;
    const existing = counts.get(row.comment_id) ?? emptyReactionCounts();
    existing[row.kind] += 1;
    counts.set(row.comment_id, existing);
    if (viewerUserId && row.reactor_user_id === viewerUserId) {
      viewer.set(row.comment_id, [...(viewer.get(row.comment_id) ?? []), row.kind]);
    }
  }
  return { counts, viewer };
}

const COMMENT_SELECT = `
  SELECT c.id::text AS id,
         c.parent_comment_id::text AS parent_comment_id,
         c.author_user_id,
         c.author_username,
         c.body,
         c.status,
         c.export_to_blog,
         c.export_review,
         c.export_refusal_reason,
         to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS created_at,
         t.post_repo, t.post_slug, t.post_title
    FROM fireside_comments c
    JOIN fireside_threads t ON t.id = c.thread_id`;

function toComment(
  row: CommentRow,
  reactions: Record<FiresideReactionKind, number>,
  viewerReactions: FiresideReactionKind[],
  viewerUserId: string | null,
): FiresideComment {
  return {
    id: row.id,
    parentCommentId: row.parent_comment_id,
    // A display name, never a user id or an email — this shape is returned on a public route.
    authorName: row.author_username?.trim() || 'A member',
    body: row.body,
    createdAt: row.created_at,
    reactions,
    viewerReactions,
    isOwn: viewerUserId != null && viewerUserId === row.author_user_id,
  };
}

/**
 * Every comment on a post that the public may see, plus — when somebody is signed in — their own
 * held or removed ones, so a person always sees what they wrote.
 */
export async function listThreadComments(
  post: FiresidePostRef,
  viewerUserId: string | null,
): Promise<{ thread: FiresideThread | null; comments: FiresideComment[] }> {
  const thread = await findThread(post);
  if (!thread) return { thread: null, comments: [] };

  const result = await queryDb<CommentRow>(
    `${COMMENT_SELECT}
      WHERE c.thread_id = $1::uuid AND c.status <> 'withdrawn'
      ORDER BY c.created_at ASC`,
    [thread.id],
  );

  const approved = await listUnlockedUserIds(result.rows.map((row) => row.author_user_id));
  const readable = result.rows.filter((row) =>
    isPubliclyVisible({ status: row.status, authorIsApproved: approved.has(row.author_user_id) })
    || (viewerUserId != null && row.author_user_id === viewerUserId));

  const { counts, viewer } = await readReactions(readable.map((row) => row.id), viewerUserId);
  const comments = readable.map((row) =>
    toComment(row, counts.get(row.id) ?? emptyReactionCounts(), viewer.get(row.id) ?? [], viewerUserId));
  return { thread, comments };
}

async function countCommentsToday(userId: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) AS count FROM fireside_comments
      WHERE author_user_id = $1 AND created_at > NOW() - INTERVAL '1 day'`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? '0');
}

async function refuseParent(threadId: string, parentCommentId: string | null): Promise<CommentRefusal | null> {
  if (!parentCommentId) return null;
  const result = await queryDb<{ parent_comment_id: string | null }>(
    `SELECT parent_comment_id::text AS parent_comment_id FROM fireside_comments
      WHERE id = $1::uuid AND thread_id = $2::uuid LIMIT 1`,
    [parentCommentId, threadId],
  );
  const row = result.rows[0];
  if (!row) return 'parent_not_found';
  // One level deep. A reply to a reply is refused rather than silently re-parented, so the person
  // is told the shape of the conversation instead of having their comment moved.
  return row.parent_comment_id ? 'reply_depth_exceeded' : null;
}

export type CreateCommentOutcome =
  | { status: 'created'; commentId: string; isPubliclyVisible: boolean }
  | { status: 'refused'; reason: CommentRefusal };

export async function createComment(
  userId: string,
  authorUsername: string,
  input: FiresideCommentInput,
): Promise<CreateCommentOutcome> {
  const bodyProblem = describeCommentBody(input.body);
  if (bodyProblem) return { status: 'refused', reason: bodyProblem };

  if (await countCommentsToday(userId) >= FIRESIDE_MAX_COMMENTS_PER_DAY) {
    return { status: 'refused', reason: 'daily_limit_reached' };
  }

  const thread = await getOrCreateThread({ repo: input.postRepo, slug: input.postSlug }, input.postTitle);
  if (thread.isClosed) return { status: 'refused', reason: 'thread_closed' };

  const parentProblem = await refuseParent(thread.id, input.parentCommentId);
  if (parentProblem) return { status: 'refused', reason: parentProblem };

  const commentId = randomUUID();
  await queryDb(
    `INSERT INTO fireside_comments (id, thread_id, parent_comment_id, author_user_id, author_username, body)
     VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6)`,
    [commentId, thread.id, input.parentCommentId, userId, authorUsername.trim(), input.body.trim()],
  );

  const approved = await listUnlockedUserIds([userId]);
  return { status: 'created', commentId, isPubliclyVisible: approved.has(userId) };
}

/** The author's own comments, in one list, each labeled with what is happening to it. */
export async function listOwnComments(userId: string, limit = 50, offset = 0): Promise<FiresideOwnComment[]> {
  const result = await queryDb<CommentRow>(
    `${COMMENT_SELECT}
      WHERE c.author_user_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  const approved = await listUnlockedUserIds([userId]);
  const authorIsApproved = approved.has(userId);
  const { counts, viewer } = await readReactions(result.rows.map((row) => row.id), userId);

  return result.rows.map((row) => ({
    ...toComment(row, counts.get(row.id) ?? emptyReactionCounts(), viewer.get(row.id) ?? [], userId),
    state: commentStateForAuthor({ status: row.status, authorIsApproved }),
    exportToBlog: row.export_to_blog,
    exportReview: row.export_review,
    exportRefusalReason: row.export_refusal_reason,
    postRepo: row.post_repo,
    postSlug: row.post_slug,
    postTitle: row.post_title,
  }));
}

/**
 * Every comment, newest first, for an admin to work through.
 *
 * The export queue is a screen for one decision; this is the other half of moderation, which until
 * now meant knowing a comment's id and calling the route by hand. It shows removed and withdrawn
 * rows as well as live ones: a list that hides what an admin already acted on is a list they cannot
 * use to undo anything.
 *
 * The author's approval state is resolved so each row can say whether it is actually public yet —
 * the same rule as everywhere else, read from visibility.ts rather than guessed at from `status`.
 */
export async function listRecentComments(limit = 20, offset = 0): Promise<FiresideOwnComment[]> {
  const result = await queryDb<CommentRow>(
    `${COMMENT_SELECT}
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  if (result.rows.length === 0) return [];

  const approved = await listUnlockedUserIds(result.rows.map((row) => row.author_user_id));
  const { counts, viewer } = await readReactions(result.rows.map((row) => row.id), null);

  return result.rows.map((row) => ({
    ...toComment(row, counts.get(row.id) ?? emptyReactionCounts(), viewer.get(row.id) ?? [], null),
    state: commentStateForAuthor({
      status: row.status,
      authorIsApproved: approved.has(row.author_user_id),
    }),
    exportToBlog: row.export_to_blog,
    exportReview: row.export_review,
    exportRefusalReason: row.export_refusal_reason,
    postRepo: row.post_repo,
    postSlug: row.post_slug,
    postTitle: row.post_title,
  }));
}

/**
 * Comments matching a search, newest first.
 *
 * Being searchable is one of the four reasons these are in Postgres rather than in a chat product,
 * and until now nothing indexed them. `websearch_to_tsquery` rather than `to_tsquery` because the
 * input is typed by a person: it takes quoted phrases and `or` and a leading `-` the way a search
 * box is expected to, and — the reason it matters here — it cannot be made to throw by an
 * unbalanced quote or a stray operator, which `to_tsquery` does on input as ordinary as `it's`.
 *
 * The `english` configuration has to match the one in the index or Postgres quietly does a
 * sequential scan instead.
 */
export async function searchComments(
  query: string,
  limit = 20,
  offset = 0,
): Promise<FiresideOwnComment[]> {
  const result = await queryDb<CommentRow>(
    `${COMMENT_SELECT}
      WHERE to_tsvector('english', c.body) @@ websearch_to_tsquery('english', $1)
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3`,
    [query, limit, offset],
  );
  if (result.rows.length === 0) return [];

  const approved = await listUnlockedUserIds(result.rows.map((row) => row.author_user_id));
  const { counts, viewer } = await readReactions(result.rows.map((row) => row.id), null);

  return result.rows.map((row) => ({
    ...toComment(row, counts.get(row.id) ?? emptyReactionCounts(), viewer.get(row.id) ?? [], null),
    state: commentStateForAuthor({
      status: row.status,
      authorIsApproved: approved.has(row.author_user_id),
    }),
    exportToBlog: row.export_to_blog,
    exportReview: row.export_review,
    exportRefusalReason: row.export_refusal_reason,
    postRepo: row.post_repo,
    postSlug: row.post_slug,
    postTitle: row.post_title,
  }));
}

export async function countSearchComments(query: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) AS count FROM fireside_comments c
      WHERE to_tsvector('english', c.body) @@ websearch_to_tsquery('english', $1)`,
    [query],
  );
  return Number(result.rows[0]?.count ?? '0');
}

export async function countAllComments(): Promise<number> {
  const result = await queryDb<{ count: string }>(`SELECT COUNT(*) AS count FROM fireside_comments`);
  return Number(result.rows[0]?.count ?? '0');
}

export async function countOwnComments(userId: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) AS count FROM fireside_comments WHERE author_user_id = $1`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? '0');
}

/**
 * The author takes their own comment down. Kept as a row with `withdrawn` rather than deleted, so a
 * reply under it does not lose its parent; the body is emptied because withdrawing means the words
 * go, not merely that they are hidden.
 */
export async function withdrawOwnComment(userId: string, commentId: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE fireside_comments
        SET status = 'withdrawn', body = '', export_to_blog = FALSE,
            export_review = 'not_requested', export_reviewed_by = NULL, export_reviewed_at = NULL,
            updated_at = NOW()
      WHERE id = $1::uuid AND author_user_id = $2 AND status <> 'withdrawn'`,
    [commentId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function toggleReaction(
  userId: string,
  commentId: string,
  kind: FiresideReactionKind,
): Promise<'added' | 'removed' | 'not_found'> {
  const exists = await queryDb<{ id: string }>(
    `SELECT id::text AS id FROM fireside_comments WHERE id = $1::uuid AND status = 'visible' LIMIT 1`,
    [commentId],
  );
  if (!exists.rows[0]) return 'not_found';

  const removed = await queryDb(
    `DELETE FROM fireside_reactions WHERE comment_id = $1::uuid AND reactor_user_id = $2 AND kind = $3`,
    [commentId, userId, kind],
  );
  if ((removed.rowCount ?? 0) > 0) return 'removed';

  await queryDb(
    `INSERT INTO fireside_reactions (id, comment_id, reactor_user_id, kind)
     VALUES ($1, $2::uuid, $3, $4)
     ON CONFLICT (comment_id, reactor_user_id, kind) DO NOTHING`,
    [randomUUID(), commentId, userId, kind],
  );
  return 'added';
}

/** An admin takes a comment down, or puts it back. */
export async function moderateComment(input: {
  adminId: string;
  commentId: string;
  action: 'remove' | 'restore';
  reason: string;
}): Promise<boolean> {
  const result = input.action === 'remove'
    ? await queryDb(
        `UPDATE fireside_comments
            SET status = 'removed', removed_by = $2, removed_at = NOW(), removal_reason = $3,
                export_to_blog = FALSE,
                -- A removed comment leaves the export queue: there is nothing to decide about
                -- copying out something that is no longer in the conversation. An export an admin
                -- already refused keeps that record; anything else resets.
                export_review = CASE WHEN export_review = 'refused' THEN 'refused' ELSE 'not_requested' END,
                updated_at = NOW()
          WHERE id = $1::uuid AND status = 'visible'`,
        [input.commentId, input.adminId, input.reason],
      )
    : await queryDb(
        `UPDATE fireside_comments
            SET status = 'visible', removed_by = NULL, removed_at = NULL, removal_reason = NULL, updated_at = NOW()
          WHERE id = $1::uuid AND status = 'removed'`,
        [input.commentId],
      );
  return (result.rowCount ?? 0) > 0;
}

export async function setThreadClosed(threadId: string, isClosed: boolean): Promise<boolean> {
  const result = await queryDb(
    `UPDATE fireside_threads SET is_closed = $2, updated_at = NOW() WHERE id = $1::uuid`,
    [threadId, isClosed],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Everything a member wrote here, removed when they delete their account. */
export async function deleteAllForUser(userId: string): Promise<{ comments: number; reactions: number }> {
  const reactions = await queryDb(`DELETE FROM fireside_reactions WHERE reactor_user_id = $1`, [userId]);
  const comments = await queryDb(`DELETE FROM fireside_comments WHERE author_user_id = $1`, [userId]);
  return { comments: comments.rowCount ?? 0, reactions: reactions.rowCount ?? 0 };
}
