import { queryDb } from 'lib/db/postgres';
import { feedAuthorHandle } from 'lib/feed/author-handle';
import {
  GATED_MAX_MESSAGE_LENGTH,
  GATED_MAX_MESSAGE_URLS,
  GATED_POST_RATE_LIMIT,
  GATED_POST_RATE_WINDOW_MINUTES,
  isGatedReactionEmoji,
} from './gated-channel-shared';

// Gated contributor channel — message history storage. Mirrors the Commons architecture exactly:
// the app database is the source of truth for messages (custom UI + polling) and Stream is only
// the live layer on top. Messages here are visible ONLY to channel members (the eligibility flag)
// and moderators/admins — never to the public Commons or the feed.

export type GatedChannelReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type GatedChannelMessage = {
  id: string;
  authorUserId: string;
  authorUsername: string | null;
  displayName: string;
  body: string;
  createdAtIso: string;
  // Signal-style quoted reply (author handle + short snippet + the quoted post's id, so the client
  // can jump to the original message when the quote is tapped), resolved server-side. Null when
  // the message is not a reply.
  quotedMessage: { author: string; snippet: string; postId: string | null } | null;
  reactions: GatedChannelReactionSummary[];
};

type PostRow = {
  id: string;
  author_user_id: string;
  author_username: string | null;
  body: string;
  reply_to_post_id: string | null;
  created_at: string;
  quoted_author_user_id: string | null;
  quoted_author_username: string | null;
  quoted_body: string | null;
};

type ReactionRow = {
  post_id: string;
  emoji: string;
  count: string;
  reacted_by_me: boolean;
};

// A malformed post id is treated as not-found (mirrors the Commons' normalizeUuid handling)
// instead of surfacing a database cast error as a 503.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Recent messages, oldest-first, with quoted-reply references and the viewer's reaction state.
// Reads exclude soft-deleted posts and filter to moderation_status 'accepted' (mirroring the
// Commons column); a quote whose source post was since deleted or not accepted resolves to
// nothing rather than resurfacing hidden content.
export async function listGatedChannelMessages(
  viewerUserId: string,
  limit = 50,
): Promise<GatedChannelMessage[]> {
  // The inner query selects the most-recent window; the outer ORDER BY flips it to oldest-first
  // so the database returns the rows in display order and no in-process reversal is needed.
  const posts = await queryDb<PostRow>(
    `SELECT recent.id, recent.author_user_id, recent.author_username, recent.body,
            recent.reply_to_post_id, recent.created_at::text,
            recent.quoted_author_user_id, recent.quoted_author_username, recent.quoted_body
     FROM (
       SELECT p.id, p.author_user_id, p.author_username, p.body, p.reply_to_post_id,
              p.created_at,
              q.author_user_id AS quoted_author_user_id,
              q.author_username AS quoted_author_username,
              q.body AS quoted_body
       FROM contributor_access_channel_posts p
       LEFT JOIN contributor_access_channel_posts q
         ON q.id = p.reply_to_post_id
        AND q.deleted_at IS NULL
        AND q.moderation_status = 'accepted'
       WHERE p.deleted_at IS NULL
         AND p.moderation_status = 'accepted'
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $1
     ) recent
     ORDER BY recent.created_at ASC, recent.id ASC`,
    [Math.max(1, Math.min(limit, 100))],
  );

  const postIds = posts.rows.map((row) => row.id);
  const reactionsByPost = new Map<string, GatedChannelReactionSummary[]>();
  if (postIds.length > 0) {
    const reactions = await queryDb<ReactionRow>(
      `SELECT post_id, emoji, COUNT(*)::text AS count,
              BOOL_OR(user_id = $2) AS reacted_by_me
       FROM contributor_access_channel_post_reactions
       WHERE post_id = ANY($1::uuid[])
       GROUP BY post_id, emoji`,
      [postIds, viewerUserId],
    );
    for (const row of reactions.rows) {
      const list = reactionsByPost.get(row.post_id) ?? [];
      list.push({ emoji: row.emoji, count: Number(row.count), reactedByMe: row.reacted_by_me });
      reactionsByPost.set(row.post_id, list);
    }
  }

  return posts.rows.map((row) => ({
    id: row.id,
    authorUserId: row.author_user_id,
    authorUsername: row.author_username,
    displayName: feedAuthorHandle(row.author_username, row.author_user_id),
    body: row.body,
    createdAtIso: row.created_at,
    quotedMessage: row.quoted_body != null && row.quoted_author_user_id != null
      ? {
        author: feedAuthorHandle(row.quoted_author_username, row.quoted_author_user_id),
        snippet: row.quoted_body.trim().slice(0, 120),
        postId: row.reply_to_post_id,
      }
      : null,
    reactions: reactionsByPost.get(row.id) ?? [],
  }));
}

export function validateGatedChannelPostBody(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= GATED_MAX_MESSAGE_LENGTH;
}

// Content gate — the same checks the Commons runs on community posts (passesFeedModeration in
// lib/feed/repository.ts): non-empty, no raw `<`/`>` (blocks pasted markup/script), and at most
// GATED_MAX_MESSAGE_URLS links. A failing post is refused outright (422 at the route), exactly
// like the Commons — it is never stored, so there is nothing for other members to ever see.
export function passesGatedChannelModeration(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  if (/[<>]/.test(text)) {
    return false;
  }
  const urlCount = (text.match(/https?:\/\//g) ?? []).length;
  return urlCount <= GATED_MAX_MESSAGE_URLS;
}

// Posting rate limit — the same shape and threshold as the Commons community-post limit
// (evaluateFeedRateLimit: count the member's rows inside the window; 8 per 30 minutes).
// Soft-deleted rows still count, so delete-and-repost cannot bypass the window.
async function evaluateGatedChannelPostRateLimit(authorUserId: string): Promise<boolean> {
  const result = await queryDb<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM contributor_access_channel_posts
     WHERE author_user_id = $1
       AND created_at >= NOW() - ($2::text || ' minutes')::interval`,
    [authorUserId, String(GATED_POST_RATE_WINDOW_MINUTES)],
  );
  return Number.parseInt(result.rows[0]?.total ?? '0', 10) < GATED_POST_RATE_LIMIT;
}

// Create a post (optionally as a Signal-style reply). Runs the Commons-mirrored content gate and
// per-member rate limit first. Throws 'content_policy_violation' when the content gate fails,
// 'rate_limit_exceeded' when the member is over the posting window, and 'reply_target_not_found'
// when the quoted post no longer exists (or was deleted / not accepted).
export async function createGatedChannelPost(input: {
  authorUserId: string;
  authorUsername: string | null;
  body: string;
  replyToPostId: string | null;
}): Promise<{ postId: string; createdAtIso: string }> {
  const body = input.body.trim();
  if (!passesGatedChannelModeration(body)) {
    throw new Error('content_policy_violation');
  }
  if (input.replyToPostId) {
    const target = await queryDb<{ id: string }>(
      `SELECT id FROM contributor_access_channel_posts
       WHERE id = $1 AND deleted_at IS NULL AND moderation_status = 'accepted'`,
      [input.replyToPostId],
    );
    if (target.rows.length === 0) {
      throw new Error('reply_target_not_found');
    }
  }
  const allowed = await evaluateGatedChannelPostRateLimit(input.authorUserId);
  if (!allowed) {
    throw new Error('rate_limit_exceeded');
  }
  const result = await queryDb<{ id: string; created_at: string }>(
    `INSERT INTO contributor_access_channel_posts (id, author_user_id, author_username, body, reply_to_post_id, moderation_status)
     VALUES ($1, $2, $3, $4, $5, 'accepted')
     RETURNING id, created_at::text`,
    [crypto.randomUUID(), input.authorUserId, input.authorUsername, body, input.replyToPostId],
  );
  return { postId: result.rows[0].id, createdAtIso: result.rows[0].created_at };
}

// Soft-delete a post: author, or an admin acting as moderator (the disclosed moderator power).
// Content is hidden from every read, not erased — deleted_at/deleted_by record when and by whom.
// Returns which path applied so the route can audit them under distinct commands. Throws
// 'post_not_found' when the post does not exist or is already deleted, and 'not_post_owner' when
// a non-admin tries to delete someone else's post.
export async function deleteGatedChannelPost(input: {
  postId: string;
  actorId: string;
  isAdmin: boolean;
}): Promise<'author' | 'admin'> {
  if (!UUID_PATTERN.test(input.postId)) {
    throw new Error('post_not_found');
  }
  const post = await queryDb<{ author_user_id: string }>(
    `SELECT author_user_id FROM contributor_access_channel_posts
     WHERE id = $1 AND deleted_at IS NULL`,
    [input.postId],
  );
  if (post.rows.length === 0) {
    throw new Error('post_not_found');
  }
  const isAuthor = post.rows[0].author_user_id === input.actorId;
  if (!isAuthor && !input.isAdmin) {
    throw new Error('not_post_owner');
  }
  await queryDb(
    `UPDATE contributor_access_channel_posts
     SET deleted_at = NOW(), deleted_by = $2
     WHERE id = $1 AND deleted_at IS NULL`,
    [input.postId, input.actorId],
  );
  return isAuthor ? 'author' : 'admin';
}

// Toggle the viewer's reaction on a post. Returns the resulting state, or throws
// 'post_not_found' / 'invalid_emoji'.
export async function toggleGatedChannelReaction(input: {
  postId: string;
  userId: string;
  emoji: string;
}): Promise<{ reacted: boolean }> {
  if (!isGatedReactionEmoji(input.emoji)) {
    throw new Error('invalid_emoji');
  }
  if (!UUID_PATTERN.test(input.postId)) {
    throw new Error('post_not_found');
  }
  const post = await queryDb<{ id: string }>(
    `SELECT id FROM contributor_access_channel_posts
     WHERE id = $1 AND deleted_at IS NULL AND moderation_status = 'accepted'`,
    [input.postId],
  );
  if (post.rows.length === 0) {
    throw new Error('post_not_found');
  }
  const removed = await queryDb<{ post_id: string }>(
    `DELETE FROM contributor_access_channel_post_reactions
     WHERE post_id = $1 AND user_id = $2 AND emoji = $3
     RETURNING post_id`,
    [input.postId, input.userId, input.emoji],
  );
  if (removed.rows.length > 0) {
    return { reacted: false };
  }
  await queryDb(
    `INSERT INTO contributor_access_channel_post_reactions (post_id, user_id, emoji)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id, user_id, emoji) DO NOTHING`,
    [input.postId, input.userId, input.emoji],
  );
  return { reacted: true };
}
