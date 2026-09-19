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
  FIRESIDE_ALL_REACTION_KINDS,
  FIRESIDE_COUNTED_KINDS,
  FIRESIDE_MAX_COMMENTS_PER_DAY,
  FIRESIDE_MAX_COMMENT_LENGTH,
  FIRESIDE_MIN_COMMENT_LENGTH,
} from './constants';
import type {
  ExportReview,
  FiresideAdminThread,
  FiresideAnyReactionKind,
  FiresideAuditEvent,
  FiresideComment,
  FiresideCommentInput,
  FiresideCommentStatus,
  FiresideCountedKind,
  FiresideOwnComment,
  FiresidePostRef,
  FiresideThread,
} from './types';
import { exportReviewAfterEdit } from './export-review';
import { commentStateForAuthor, isPubliclyVisible, refuseEdit, type EditRefusal } from './visibility';

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
  edited_at: string | null;
  post_repo: string;
  post_slug: string;
  post_title: string;
};

function emptyReactionCounts(): Record<FiresideCountedKind, number> {
  return { recognize: 0, helpful: 0, same_here: 0, upvote: 0 };
}

/**
 * Whether this kind may appear in a count anybody is shown.
 *
 * `downvote` is stored and is never counted. The person who left one sees their own — that is their
 * own data, and the button has to be able to show as pressed — but no total of them goes to the
 * author, a reader, or an admin screen. What a downvote should eventually do is undecided, and a
 * number on a screen would decide it (owner, 2026-09-14).
 */
function isCountedKind(kind: string): kind is FiresideCountedKind {
  return (FIRESIDE_COUNTED_KINDS as readonly string[]).includes(kind);
}

async function readReactions(commentIds: string[], viewerUserId: string | null): Promise<{
  counts: Map<string, Record<FiresideCountedKind, number>>;
  viewer: Map<string, FiresideAnyReactionKind[]>;
}> {
  const counts = new Map<string, Record<FiresideCountedKind, number>>();
  const viewer = new Map<string, FiresideAnyReactionKind[]>();
  if (commentIds.length === 0) return { counts, viewer };

  const result = await queryDb<{ comment_id: string; kind: FiresideAnyReactionKind; reactor_user_id: string }>(
    `SELECT comment_id::text AS comment_id, kind, reactor_user_id
       FROM fireside_reactions
      WHERE comment_id = ANY($1::uuid[])`,
    [commentIds],
  );

  for (const row of result.rows) {
    const mine = viewerUserId != null && row.reactor_user_id === viewerUserId;
    // A downvote reaches the viewer list and never the counts. Somebody sees their own; nobody
    // sees a total.
    if (mine && (FIRESIDE_ALL_REACTION_KINDS as readonly string[]).includes(row.kind)) {
      viewer.set(row.comment_id, [...(viewer.get(row.comment_id) ?? []), row.kind]);
    }
    if (!isCountedKind(row.kind)) continue;
    const existing = counts.get(row.comment_id) ?? emptyReactionCounts();
    existing[row.kind] += 1;
    counts.set(row.comment_id, existing);
  }
  return { counts, viewer };
}

// What every read of a comment returns. `withdrawn_body` is deliberately NOT here: this select
// feeds the public thread read, and the author's own copy of something they took down must not be
// reachable from a shape that anybody can request. Only OWN_COMMENT_SELECT below adds it, and only
// listOwnComments uses that, scoped to the caller's own rows.
const COMMENT_COLUMNS = `
         c.id::text AS id,
         c.parent_comment_id::text AS parent_comment_id,
         c.author_user_id,
         c.author_username,
         c.body,
         c.status,
         c.export_to_blog,
         c.export_review,
         c.export_refusal_reason,
         to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS created_at,
         to_char(c.edited_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS edited_at,
         t.post_repo, t.post_slug, t.post_title`;

const COMMENT_FROM = `
    FROM fireside_comments c
    JOIN fireside_threads t ON t.id = c.thread_id`;

const COMMENT_SELECT = `
  SELECT ${COMMENT_COLUMNS}
  ${COMMENT_FROM}`;

/** The same rows plus the author's own copy of anything they took down. Author-scoped reads only. */
const OWN_COMMENT_SELECT = `
  SELECT ${COMMENT_COLUMNS},
         c.withdrawn_body
  ${COMMENT_FROM}`;

function toComment(
  row: CommentRow,
  reactions: Record<FiresideCountedKind, number>,
  viewerReactions: FiresideAnyReactionKind[],
  viewerUserId: string | null,
): FiresideComment {
  return {
    id: row.id,
    parentCommentId: row.parent_comment_id,
    // A display name, never a user id or an email — this shape is returned on a public route.
    authorName: row.author_username?.trim() || 'A member',
    body: row.body,
    createdAt: row.created_at,
    // Null until the author rewrites it, so the "edited" mark beside a comment means what it says.
    editedAt: row.edited_at,
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

/**
 * Who wrote a comment, for telling them somebody answered it.
 *
 * Returns the id only, never anything shown on a screen: the caller hands it to the notification
 * system, which addresses a member without displaying anything about them.
 */
export async function findCommentAuthorUserId(commentId: string): Promise<string | null> {
  const result = await queryDb<{ author_user_id: string }>(
    `SELECT author_user_id FROM fireside_comments WHERE id = $1::uuid LIMIT 1`,
    [commentId],
  );
  return result.rows[0]?.author_user_id ?? null;
}

/** The author's own comments, in one list, each labeled with what is happening to it. */
export async function listOwnComments(userId: string, limit = 50, offset = 0): Promise<FiresideOwnComment[]> {
  const result = await queryDb<CommentRow & { withdrawn_body: string | null }>(
    `${OWN_COMMENT_SELECT}
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
    // What they wrote, for them alone, once they have taken it down. Null on everything else, so a
    // screen shows it only where there is something to show.
    withdrawnBody: row.status === 'withdrawn' ? row.withdrawn_body : null,
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
    // Always null here, and deliberately so. `withdrawn_body` is the author's own copy of something
    // they took down, and this is an admin read: the select behind it does not carry that column at
    // all, so there is nothing to return even if somebody later wanted it here.
    withdrawnBody: null,
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
    // Null for the same reason as the admin list above: this is an admin read built from
    // COMMENT_SELECT, which does not carry the author's own copy of anything they took down.
    withdrawnBody: null,
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
 * reply under it does not lose its parent; `body` is emptied because withdrawing means the words go
 * from the conversation, not merely that they are hidden.
 *
 * The words are copied to `withdrawn_body` first, which is the author's own copy and nobody else's.
 * Taking a comment down cannot be undone, so the moment somebody most needs to read what they wrote
 * is just after they have destroyed it, when they are checking whether they meant to (owner report,
 * 2026-09-14). Only /api/fireside/mine reads that column, and it returns the caller's own rows;
 * the public thread read and the blog export feed never select it.
 *
 * Copies from `body` rather than taking the text as an argument: the row is the truth about what
 * was written, and a client-supplied body could put words in somebody's mouth on their own screen.
 */
export async function withdrawOwnComment(userId: string, commentId: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE fireside_comments
        SET status = 'withdrawn',
            withdrawn_body = COALESCE(NULLIF(body, ''), withdrawn_body),
            body = '',
            export_to_blog = FALSE,
            export_review = 'not_requested', export_reviewed_by = NULL, export_reviewed_at = NULL,
            updated_at = NOW()
      WHERE id = $1::uuid AND author_user_id = $2 AND status <> 'withdrawn'`,
    [commentId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Why an edit was refused, in a word the route turns into a sentence. */
export type EditRefusalReason = EditRefusal | 'body_too_short' | 'body_too_long';

export type EditCommentOutcome =
  | { status: 'edited'; editedAt: string; exportRequeued: boolean }
  | { status: 'refused'; reason: EditRefusalReason }
  | { status: 'not_found' };

/**
 * The author rewrites their own comment, in place.
 *
 * The same edit the Commons has had since it shipped, and it is here because the only way to fix a
 * typo was to take the comment down and write it again (owner report, 2026-09-17) — which loses the
 * replies under it, the reactions on it, and its place in the conversation, all to change one word.
 * The row keeps its id, so none of that moves.
 *
 * Author-only, and scoped by `author_user_id` in both statements rather than by a client-supplied id
 * alone: a comment that is not the caller's own is answered as though it is not there, which is what
 * every other author-scoped write here does.
 *
 * The new words are checked exactly as the first ones were, so an edit is never a way to post
 * something a fresh comment would have been refused for. What the author may edit at all is
 * refuseEdit in ./visibility.ts, and what an edit does to a pending blog export is
 * exportReviewAfterEdit in ./export-review.ts; neither rule is re-derived here.
 */
export async function editOwnComment(
  userId: string,
  commentId: string,
  bodyInput: string,
): Promise<EditCommentOutcome> {
  const bodyProblem = describeCommentBody(bodyInput);
  if (bodyProblem === 'body_too_short' || bodyProblem === 'body_too_long') {
    return { status: 'refused', reason: bodyProblem };
  }

  const current = await queryDb<{ status: FiresideCommentStatus; export_review: ExportReview; is_closed: boolean }>(
    `SELECT c.status, c.export_review, t.is_closed
       FROM fireside_comments c
       JOIN fireside_threads t ON t.id = c.thread_id
      WHERE c.id = $1::uuid AND c.author_user_id = $2
      LIMIT 1`,
    [commentId, userId],
  );
  const row = current.rows[0];
  if (!row) return { status: 'not_found' };

  const refusal = refuseEdit({ status: row.status, threadIsClosed: row.is_closed });
  if (refusal) return { status: 'refused', reason: refusal };

  // An admin approved words, not a row. If the text changes under an approval, the approval goes
  // back in the queue to be read again — otherwise a rewrite is a way to put anything at all into
  // the blog's permanently archived build under a yes somebody gave to something else.
  const nextReview = exportReviewAfterEdit(row.export_review);
  const exportRequeued = nextReview !== row.export_review;

  const updated = await queryDb<{ edited_at: string }>(
    `UPDATE fireside_comments
        SET body = $3,
            edited_at = NOW(),
            export_review = $4,
            export_reviewed_by = CASE WHEN $5 THEN NULL ELSE export_reviewed_by END,
            export_reviewed_at = CASE WHEN $5 THEN NULL ELSE export_reviewed_at END,
            updated_at = NOW()
      WHERE id = $1::uuid AND author_user_id = $2 AND status = 'visible'
      RETURNING to_char(edited_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS edited_at`,
    [commentId, userId, bodyInput.trim(), nextReview, exportRequeued],
  );
  const editedAt = updated.rows[0]?.edited_at;
  if (!editedAt) return { status: 'not_found' };

  return { status: 'edited', editedAt, exportRequeued };
}

/** The other vote, for a kind that is one — pressing one clears the other. Null for a reaction. */
function opposingVote(kind: FiresideAnyReactionKind): FiresideAnyReactionKind | null {
  if (kind === 'upvote') return 'downvote';
  if (kind === 'downvote') return 'upvote';
  return null;
}

export async function toggleReaction(
  userId: string,
  commentId: string,
  kind: FiresideAnyReactionKind,
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

  // Holding both votes on one comment says nothing, so taking one side drops the other. The three
  // reactions are not votes and do not clear anything.
  const opposing = opposingVote(kind);
  if (opposing) {
    await queryDb(
      `DELETE FROM fireside_reactions WHERE comment_id = $1::uuid AND reactor_user_id = $2 AND kind = $3`,
      [commentId, userId, opposing],
    );
  }

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

type AdminThreadRow = ThreadRow & {
  hidden_count: string | number | null;
  last_comment_at: string | null;
};

/**
 * Every conversation, the busiest first, for the admin screen.
 *
 * Closing a thread has existed since the plugin shipped and the only way to reach the control was
 * to open the post it belongs to, which means already knowing which post. This is the list that
 * makes it a thing an admin can actually do.
 *
 * Closed threads are listed alongside open ones, and a thread whose every comment has been taken
 * out still appears with the count saying so — an admin list hides nothing (rule 131), and the
 * thread an admin most needs to find is usually the one something was already done to.
 */
export async function listAllThreads(limit = 20, offset = 0): Promise<FiresideAdminThread[]> {
  const result = await queryDb<AdminThreadRow>(
    `SELECT t.id::text AS id, t.post_repo, t.post_slug, t.post_title, t.is_closed,
            COUNT(c.id) FILTER (WHERE c.status = 'visible') AS comment_count,
            COUNT(c.id) FILTER (WHERE c.status <> 'visible') AS hidden_count,
            MAX(c.created_at) AS last_comment_at
       FROM fireside_threads t
       LEFT JOIN fireside_comments c ON c.thread_id = t.id
      GROUP BY t.id
      ORDER BY MAX(c.created_at) DESC NULLS LAST, t.created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows.map((row) => ({
    ...mapThread(row),
    hiddenCount: Number(row.hidden_count ?? '0'),
    lastCommentAt: row.last_comment_at,
  }));
}

export async function countAllThreads(): Promise<number> {
  const result = await queryDb<{ count: string }>(`SELECT COUNT(*) AS count FROM fireside_threads`);
  return Number(result.rows[0]?.count ?? '0');
}

type AuditRow = {
  id: string;
  actor_id: string;
  command: string;
  policy_status: string;
  reason: string;
  target_type: string;
  target_id: string;
  result: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/**
 * The audit trail, newest first, so somebody can read it.
 *
 * Every write here has recorded a row since the plugin shipped and nothing in the app ever showed
 * one. A record nobody can read is not a check on anything (rule 131), and this plugin's admin
 * powers are the kind that need one: removing somebody's words, and agreeing to copy them onto a
 * page that a web archive will keep forever.
 */
export async function listFiresideAuditEvents(limit = 100): Promise<FiresideAuditEvent[]> {
  // Clamped rather than trusted: the caller is an admin, but an unbounded limit from a query string
  // is still a way to ask the database for the whole table.
  const capped = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
  const result = await queryDb<AuditRow>(
    `SELECT id::text AS id, actor_id, command, policy_status, reason,
            target_type, target_id, result, metadata, created_at
       FROM fireside_audit_events
      ORDER BY created_at DESC
      LIMIT $1`,
    [capped],
  );
  return result.rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    command: row.command,
    policyStatus: row.policy_status,
    reason: row.reason,
    targetType: row.target_type,
    targetId: row.target_id,
    result: row.result,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}
