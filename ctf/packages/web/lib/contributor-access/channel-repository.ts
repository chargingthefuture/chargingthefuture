import { queryDb } from 'lib/db/postgres';
import { feedAuthorHandle } from 'lib/feed/author-handle';
import { GATED_MAX_MESSAGE_LENGTH, isGatedReactionEmoji } from './gated-channel-shared';

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
  // Signal-style quoted reply (author handle + short snippet), resolved server-side. Null when
  // the message is not a reply.
  quotedMessage: { author: string; snippet: string } | null;
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

// Recent messages, oldest-first, with quoted-reply references and the viewer's reaction state.
export async function listGatedChannelMessages(
  viewerUserId: string,
  limit = 50,
): Promise<GatedChannelMessage[]> {
  const posts = await queryDb<PostRow>(
    `SELECT p.id, p.author_user_id, p.author_username, p.body, p.reply_to_post_id,
            p.created_at::text,
            q.author_user_id AS quoted_author_user_id,
            q.author_username AS quoted_author_username,
            q.body AS quoted_body
     FROM contributor_access_channel_posts p
     LEFT JOIN contributor_access_channel_posts q ON q.id = p.reply_to_post_id
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $1`,
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

  return posts.rows.reverse().map((row) => ({
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
      }
      : null,
    reactions: reactionsByPost.get(row.id) ?? [],
  }));
}

export function validateGatedChannelPostBody(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= GATED_MAX_MESSAGE_LENGTH;
}

// Create a post (optionally as a Signal-style reply). Throws 'reply_target_not_found' when the
// quoted post no longer exists.
export async function createGatedChannelPost(input: {
  authorUserId: string;
  authorUsername: string | null;
  body: string;
  replyToPostId: string | null;
}): Promise<{ postId: string; createdAtIso: string }> {
  if (input.replyToPostId) {
    const target = await queryDb<{ id: string }>(
      `SELECT id FROM contributor_access_channel_posts WHERE id = $1`,
      [input.replyToPostId],
    );
    if (target.rows.length === 0) {
      throw new Error('reply_target_not_found');
    }
  }
  const result = await queryDb<{ id: string; created_at: string }>(
    `INSERT INTO contributor_access_channel_posts (id, author_user_id, author_username, body, reply_to_post_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at::text`,
    [crypto.randomUUID(), input.authorUserId, input.authorUsername, input.body.trim(), input.replyToPostId],
  );
  return { postId: result.rows[0].id, createdAtIso: result.rows[0].created_at };
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
  const post = await queryDb<{ id: string }>(
    `SELECT id FROM contributor_access_channel_posts WHERE id = $1`,
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
