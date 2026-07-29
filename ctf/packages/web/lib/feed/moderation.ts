import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { FEED_MODERATION_STATUS, type FeedModerationStatus } from 'lib/feed/constants';
import { normalizeUuid } from 'lib/feed/repository';

// Commons moderation — taking a member's post or reply down, and putting it back.
//
// Why this exists: `feed_community_posts` and `feed_community_replies` have carried a
// `moderation_status` column since they were created, but no query read it and no route wrote
// anything but 'accepted'. So the column was decoration: the only way to remove something from the
// Commons was to DELETE the row, which is unrecoverable and destroys the member's own words along
// with the reply thread hanging off them. Hiding is reversible; deletion is not, and a moderator
// acting fast on a judgement call should not be making an irreversible one.
//
// The read path now filters on `moderation_status = 'accepted'` in every place Commons content is
// read (the member timeline, the signed-out public list, and the quoted-post lookup), so hiding here
// genuinely hides. Author deletion is unchanged and still available to the member.
//
// Deliberately NOT here: editing someone else's words. A moderator can take a post down or put it
// back; they cannot rewrite it and leave it attributed to the author.

export type FeedModerationTarget = 'post' | 'reply';

export type FeedModerationOutcome =
  | { status: 'ok'; previous: FeedModerationStatus; next: FeedModerationStatus }
  | { status: 'not_found' }
  | { status: 'unchanged'; previous: FeedModerationStatus };

// One row in the moderation queue. `flaggedCount` is only ever populated for a post — replies carry
// no rating rows — and reports how many members flagged it, so the queue can lead with what the
// community has already objected to rather than making a moderator read everything.
export type FeedModerationQueueRow = {
  target: FeedModerationTarget;
  id: string;
  postId: string | null;
  authorUserId: string;
  authorUsername: string | null;
  body: string;
  moderationStatus: FeedModerationStatus;
  createdAtIso: string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// Set the moderation status of a Commons post or reply.
//
// Returns 'unchanged' rather than pretending to act when the row is already in the requested state,
// so a double-tap or a replayed request does not produce a second audit entry claiming a change that
// did not happen. Hiding a post does NOT hide its replies: each reply is judged on its own, and the
// read path drops the whole item from the timeline anyway once the parent post is hidden.
export async function setCommunityModerationStatus(input: {
  target: FeedModerationTarget;
  id: string;
  next: FeedModerationStatus;
}): Promise<FeedModerationOutcome> {
  const normalizedId = normalizeUuid(input.id);
  if (normalizedId === null) {
    return { status: 'not_found' };
  }

  const table = input.target === 'post' ? 'feed_community_posts' : 'feed_community_replies';

  return withDbTransaction(async (client) => {
    // Locked for the read-then-write so two moderators acting at once cannot both believe they made
    // the change, which would write two audit rows for one transition.
    const current = await client.query<{ moderation_status: string }>(
      `SELECT moderation_status FROM ${table} WHERE id = $1::uuid FOR UPDATE`,
      [normalizedId],
    );

    if (current.rows.length === 0) {
      return { status: 'not_found' as const };
    }

    // Anything that is not exactly 'hidden' is treated as visible, because that is what the read
    // path does — it admits only 'accepted'. Rows predating this feature all hold 'accepted'.
    const previous: FeedModerationStatus =
      current.rows[0].moderation_status === FEED_MODERATION_STATUS.hidden
        ? FEED_MODERATION_STATUS.hidden
        : FEED_MODERATION_STATUS.accepted;

    if (previous === input.next) {
      return { status: 'unchanged' as const, previous };
    }

    await client.query(
      `UPDATE ${table} SET moderation_status = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [normalizedId, input.next],
    );

    return { status: 'ok' as const, previous, next: input.next };
  });
}

// The moderation queue: Commons posts and replies an admin may need to look at.
//
// Ordered newest first, and hidden rows are included on purpose — a moderator needs to see what they
// have taken down in order to put it back. `onlyHidden` narrows to exactly that review.
export async function listCommonsModerationQueue(options?: {
  limit?: number;
  onlyHidden?: boolean;
}): Promise<FeedModerationQueueRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const onlyHidden = options?.onlyHidden === true;

  const result = await queryDb<{
    target: string;
    id: string;
    post_id: string | null;
    author_user_id: string;
    author_username: string | null;
    body: string;
    moderation_status: string;
    created_at: Date;
  }>(
    `
      (
        SELECT 'post' AS target, id, NULL::uuid AS post_id, author_user_id, author_username,
               body, moderation_status, created_at
        FROM feed_community_posts
        WHERE ($1::boolean = FALSE OR moderation_status = 'hidden')
        ORDER BY created_at DESC
        LIMIT $2
      )
      UNION ALL
      (
        SELECT 'reply' AS target, id, post_id, author_user_id, NULL::text AS author_username,
               body, moderation_status, created_at
        FROM feed_community_replies
        WHERE ($1::boolean = FALSE OR moderation_status = 'hidden')
        ORDER BY created_at DESC
        LIMIT $2
      )
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [onlyHidden, limit],
  );

  return result.rows.map((row) => ({
    target: row.target === 'reply' ? 'reply' : 'post',
    id: row.id,
    postId: row.post_id,
    authorUserId: row.author_user_id,
    authorUsername: row.author_username,
    body: row.body,
    moderationStatus:
      row.moderation_status === FEED_MODERATION_STATUS.hidden
        ? FEED_MODERATION_STATUS.hidden
        : FEED_MODERATION_STATUS.accepted,
    createdAtIso: toIso(row.created_at),
  }));
}

// How many Commons rows are currently hidden, for the admin dashboard counter. Counted from the
// database rather than the loaded page so the number is never a page-capped undercount.
export async function countHiddenCommonsRows(): Promise<{ posts: number; replies: number }> {
  const result = await queryDb<{ hidden_posts: string; hidden_replies: string }>(
    `
      SELECT
        (SELECT COUNT(*) FROM feed_community_posts WHERE moderation_status = 'hidden')::text AS hidden_posts,
        (SELECT COUNT(*) FROM feed_community_replies WHERE moderation_status = 'hidden')::text AS hidden_replies
    `,
  );

  const row = result.rows[0];
  return {
    posts: Number(row?.hidden_posts ?? 0),
    replies: Number(row?.hidden_replies ?? 0),
  };
}
