import { queryDb } from 'lib/db/postgres';
import { listUnlockedUserIds } from 'lib/shared/unlock-interface';
import { FIRESIDE_BLOG_ARTICLE_BASE, FIRESIDE_HELD_NOTICE } from './constants';
import { createComment, editOwnComment, insertFiresideAudit, withdrawOwnComment, type CommentRefusal } from './repository';
import type { FiresideCommentStatus, FiresidePostRef } from './types';
import { isPubliclyVisible } from './visibility';

// A blog or Quora story's Today card talks in the post's Fireside thread (owner decision,
// 2026-11-10): what somebody writes under the card is a Fireside comment on the post, with Fireside's
// own rules (held until the author is approved, the daily limit, a closed thread), and the card shows
// the thread's comments. Top-level comments only; replies stay in Fireside's own screens.

const SHOWN = 100;

export type CardThreadMessage = { id: string; authorId: string; body: string; createdAt: Date; editedAt: Date | null };

// The post a blog address names: `<blog>/article/<repo>/<slug>`, as posts.json writes it.
export function postRefFromUrl(url: string): FiresidePostRef | null {
  const prefix = `${FIRESIDE_BLOG_ARTICLE_BASE}/`;
  if (!url.startsWith(prefix)) return null;
  const parts = url.slice(prefix.length).split('/').filter(Boolean);
  if (parts.length < 2) return null;
  try {
    return { repo: decodeURIComponent(parts[0]), slug: parts.slice(1).map(decodeURIComponent).join('/') };
  } catch {
    // no-trace: an address that does not decode names no post
    return null;
  }
}

type Row = { id: string; author_user_id: string; body: string; status: FiresideCommentStatus; created_at: Date; edited_at: Date | null };

// The thread's top-level comments anybody may read, plus the viewer's own held ones, newest last.
// Comments by somebody blocked either way, or muted by the viewer, are left out, as on every card.
export async function listCardThreadMessages(post: FiresidePostRef, viewerId: string | null): Promise<CardThreadMessage[]> {
  const result = await queryDb<Row>(
    `SELECT c.id::text AS id, c.author_user_id, c.body, c.status, c.created_at, c.edited_at
       FROM fireside_comments c JOIN fireside_threads t ON t.id = c.thread_id
      WHERE t.post_repo = $1 AND t.post_slug = $2 AND c.parent_comment_id IS NULL AND c.status = 'visible'
        AND ($3::text IS NULL OR (
          NOT EXISTS (SELECT 1 FROM member_blocks mb
            WHERE (mb.blocker_user_id = $3 AND mb.blocked_user_id = c.author_user_id)
               OR (mb.blocker_user_id = c.author_user_id AND mb.blocked_user_id = $3))
          AND NOT EXISTS (SELECT 1 FROM member_mutes mm
            WHERE mm.user_id = $3 AND mm.kind = 'person' AND mm.target = c.author_user_id)))
      ORDER BY c.created_at DESC
      LIMIT ${SHOWN}`,
    [post.repo, post.slug, viewerId],
  );
  const approved = await listUnlockedUserIds(result.rows.map((row) => row.author_user_id));
  return result.rows
    .filter((row) => row.author_user_id === viewerId || isPubliclyVisible({ status: row.status, authorIsApproved: approved.has(row.author_user_id) }))
    .reverse()
    .map((row) => ({ id: row.id, authorId: row.author_user_id, body: row.body, createdAt: new Date(row.created_at), editedAt: row.edited_at ? new Date(row.edited_at) : null }));
}

const REFUSALS: Record<CommentRefusal, { message: string; status: number }> = {
  body_too_short: { message: 'Write at least 2 characters.', status: 400 },
  body_too_long: { message: 'That is longer than a comment on the post can be. Shorten it.', status: 400 },
  thread_closed: { message: 'This post is closed to new comments.', status: 409 },
  parent_not_found: { message: 'The comment you are replying to is no longer there.', status: 404 },
  reply_depth_exceeded: { message: 'Replies go one level deep.', status: 400 },
  daily_limit_reached: { message: 'That is the most comments allowed in a day. Come back tomorrow.', status: 429 },
};

export type CardThreadWrite =
  | { ok: true; held: string | null }
  | { ok: false; reason: CommentRefusal; message: string; status: number };

// A comment on the post from its Today card. Held until the author is approved, as on the blog; the
// answer says so rather than letting a saved comment look lost.
export async function writeCardThreadMessage(userId: string, username: string, post: FiresidePostRef, title: string, body: string): Promise<CardThreadWrite> {
  const outcome = await createComment(userId, username, { postRepo: post.repo, postSlug: post.slug, postTitle: title, parentCommentId: null, body });
  if (outcome.status === 'refused') return { ok: false, reason: outcome.reason, ...REFUSALS[outcome.reason] };
  await insertFiresideAudit({
    actorId: userId,
    command: 'fireside.comment.create',
    policyStatus: 'allow',
    reason: 'today_card',
    targetType: 'comment',
    targetId: outcome.commentId,
    result: outcome.isPubliclyVisible ? 'published' : 'held_for_approval',
    metadata: { postRepo: post.repo, postSlug: post.slug },
  });
  return { ok: true, held: outcome.isPubliclyVisible ? null : FIRESIDE_HELD_NOTICE };
}

// The author's own comment in this post's thread, rewritten or withdrawn. False when it is not theirs,
// not in this thread, or Fireside refuses (removed by an admin, a closed thread).
async function ownInThread(post: FiresidePostRef, commentId: string, userId: string): Promise<boolean> {
  const result = await queryDb<{ yes: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM fireside_comments c JOIN fireside_threads t ON t.id = c.thread_id
      WHERE c.id::text = $1 AND c.author_user_id = $2 AND t.post_repo = $3 AND t.post_slug = $4) AS yes`,
    [commentId, userId, post.repo, post.slug],
  );
  return result.rows[0]?.yes ?? false;
}

export async function editCardThreadMessage(post: FiresidePostRef, commentId: string, userId: string, body: string): Promise<boolean> {
  if (!(await ownInThread(post, commentId, userId))) return false;
  return (await editOwnComment(userId, commentId, body)).status === 'edited';
}

export async function withdrawCardThreadMessage(post: FiresidePostRef, commentId: string, userId: string): Promise<boolean> {
  if (!(await ownInThread(post, commentId, userId))) return false;
  return (await withdrawOwnComment(userId, commentId)) === 'withdrawn';
}

export async function findCardThreadMessage(post: FiresidePostRef, commentId: string, readerId: string): Promise<CardThreadMessage | null> {
  const messages = await listCardThreadMessages(post, readerId);
  return messages.find((message) => message.id === commentId) ?? null;
}

export async function hasWrittenInCardThread(post: FiresidePostRef, accountId: string): Promise<boolean> {
  const result = await queryDb<{ yes: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM fireside_comments c JOIN fireside_threads t ON t.id = c.thread_id
      WHERE t.post_repo = $1 AND t.post_slug = $2 AND c.author_user_id = $3 AND c.status = 'visible') AS yes`,
    [post.repo, post.slug, accountId],
  );
  return result.rows[0]?.yes ?? false;
}
