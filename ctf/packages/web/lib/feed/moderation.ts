import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  FEED_MODERATION_STATUS,
  type FeedModerationReason,
  type FeedModerationStatus,
} from 'lib/feed/constants';
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

// The four kinds of member-facing content a moderator can hide. `question` and `answer` joined the set
// on 2026-07-30: until then neither table had a `moderation_status` column at all, so a flagged answer
// could be read by an admin and then nothing could be done about it — which is why the flag queue could
// not be built and member flags reached nobody.
export type FeedModerationTarget = 'post' | 'reply' | 'question' | 'answer';

const MODERATION_TABLES: Record<FeedModerationTarget, string> = {
  post: 'feed_community_posts',
  reply: 'feed_community_replies',
  question: 'feed_questions',
  answer: 'feed_answers',
};

export function isFeedModerationTarget(value: unknown): value is FeedModerationTarget {
  return value === 'post' || value === 'reply' || value === 'question' || value === 'answer';
}

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
  moderationReason: FeedModerationReason | null;
  moderatedByUserId: string | null;
  moderatedAtIso: string | null;
  createdAtIso: string;
};

// One member's Commons footprint, for moderating by person rather than by post. The day-to-day
// problem is not a stray off-topic post — it is accounts that only ever post off-topic, so the useful
// unit of review is the author (owner, 2026-07-29).
export type FeedModerationAuthorSummary = {
  authorUserId: string;
  authorUsername: string | null;
  postCount: number;
  replyCount: number;
  hiddenCount: number;
  firstPostedAtIso: string;
  lastPostedAtIso: string;
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
  reason: FeedModerationReason | null;
  actorUserId: string;
}): Promise<FeedModerationOutcome> {
  const normalizedId = normalizeUuid(input.id);
  if (normalizedId === null) {
    return { status: 'not_found' };
  }

  const table = MODERATION_TABLES[input.target];

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

    // Restoring CLEARS the reason, actor, and timestamp rather than keeping them. Those three
    // columns describe the row's current hidden state; leaving a reason on a post that is visible
    // again would read as a standing accusation against a member whose post was put back.
    const hiding = input.next === FEED_MODERATION_STATUS.hidden;
    await client.query(
      `
        UPDATE ${table}
        SET moderation_status = $2,
            moderation_reason = $3,
            moderated_by_user_id = $4,
            moderated_at = CASE WHEN $5::boolean THEN NOW() ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1::uuid
      `,
      [normalizedId, input.next, hiding ? input.reason : null, hiding ? input.actorUserId : null, hiding],
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
  authorUserId?: string | null;
}): Promise<FeedModerationQueueRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const onlyHidden = options?.onlyHidden === true;
  // Empty string would match nothing and read as "no author on file", so normalise it away.
  const authorUserId = options?.authorUserId?.trim() || null;

  const result = await queryDb<{
    target: string;
    id: string;
    post_id: string | null;
    author_user_id: string;
    author_username: string | null;
    body: string;
    moderation_status: string;
    moderation_reason: string | null;
    moderated_by_user_id: string | null;
    moderated_at: Date | null;
    created_at: Date;
  }>(
    `
      (
        SELECT 'post' AS target, id, NULL::uuid AS post_id, author_user_id, author_username,
               body, moderation_status, moderation_reason, moderated_by_user_id, moderated_at, created_at
        FROM feed_community_posts
        WHERE ($1::boolean = FALSE OR moderation_status = 'hidden')
          AND ($3::text IS NULL OR author_user_id = $3::text)
        ORDER BY created_at DESC
        LIMIT $2
      )
      UNION ALL
      (
        SELECT 'reply' AS target, id, post_id, author_user_id, NULL::text AS author_username,
               body, moderation_status, moderation_reason, moderated_by_user_id, moderated_at, created_at
        FROM feed_community_replies
        WHERE ($1::boolean = FALSE OR moderation_status = 'hidden')
          AND ($3::text IS NULL OR author_user_id = $3::text)
        ORDER BY created_at DESC
        LIMIT $2
      )
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [onlyHidden, limit, authorUserId],
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
    moderationReason: (row.moderation_reason as FeedModerationReason | null) ?? null,
    moderatedByUserId: row.moderated_by_user_id,
    moderatedAtIso: row.moderated_at ? toIso(row.moderated_at) : null,
    createdAtIso: toIso(row.created_at),
  }));
}

// Who is posting in the Commons, ordered by volume. This is the view for the actual problem: not one
// stray off-topic post, but accounts whose whole footprint is Quora-style discussion unrelated to the
// economy. Seeing counts per person tells you whether a member wandered off topic once or has never
// been on topic — a distinction you cannot make from a reverse-chronological list of posts.
//
// Aggregate only: counts and dates, no bodies. Deciding whether to look at someone should not require
// reading everything they ever wrote.
export async function listCommonsAuthors(limit = 50): Promise<FeedModerationAuthorSummary[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const result = await queryDb<{
    author_user_id: string;
    author_username: string | null;
    post_count: string;
    reply_count: string;
    hidden_count: string;
    first_posted_at: Date;
    last_posted_at: Date;
  }>(
    `
      WITH combined AS (
        SELECT author_user_id, author_username, moderation_status, created_at, 'post' AS kind
        FROM feed_community_posts
        UNION ALL
        SELECT author_user_id, NULL::text AS author_username, moderation_status, created_at, 'reply' AS kind
        FROM feed_community_replies
      )
      SELECT
        author_user_id,
        MAX(author_username) AS author_username,
        COUNT(*) FILTER (WHERE kind = 'post')::text AS post_count,
        COUNT(*) FILTER (WHERE kind = 'reply')::text AS reply_count,
        COUNT(*) FILTER (WHERE moderation_status = 'hidden')::text AS hidden_count,
        MIN(created_at) AS first_posted_at,
        MAX(created_at) AS last_posted_at
      FROM combined
      GROUP BY author_user_id
      ORDER BY COUNT(*) DESC, MAX(created_at) DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    authorUserId: row.author_user_id,
    authorUsername: row.author_username,
    postCount: Number(row.post_count ?? 0),
    replyCount: Number(row.reply_count ?? 0),
    hiddenCount: Number(row.hidden_count ?? 0),
    firstPostedAtIso: toIso(row.first_posted_at),
    lastPostedAtIso: toIso(row.last_posted_at),
  }));
}

// One flagged answer awaiting review. `flaggedCount` is how many members rated it `flagged` — the
// signal that was already being collected and reaching nobody, because no page called the route that
// aggregated it.
export type FeedFlaggedAnswerRow = {
  answerId: string;
  questionId: string;
  questionBody: string;
  answerType: 'llm' | 'community';
  answerBody: string;
  authorUserId: string | null;
  moderationStatus: FeedModerationStatus;
  moderationReason: FeedModerationReason | null;
  flaggedCount: number;
  notHelpfulCount: number;
  createdAtIso: string;
};

// Answers members have flagged, most-flagged first, then newest.
//
// Ordered by flag count rather than by date on purpose: this is a triage queue, and the answer six
// people objected to matters more than the one that arrived most recently. Hidden answers are included
// so a moderator can see and reverse their own calls.
export async function listFlaggedAnswers(limit = 50): Promise<FeedFlaggedAnswerRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const result = await queryDb<{
    answer_id: string;
    question_id: string;
    question_body: string;
    answer_type: string;
    answer_body: string;
    author_user_id: string | null;
    moderation_status: string;
    moderation_reason: string | null;
    flagged_count: string;
    not_helpful_count: string;
    created_at: Date;
  }>(
    `
      SELECT
        fa.id AS answer_id,
        fa.question_id,
        fq.body AS question_body,
        fa.answer_type,
        fa.body AS answer_body,
        fa.author_user_id,
        fa.moderation_status,
        fa.moderation_reason,
        COUNT(*) FILTER (WHERE r.rating = 'flagged')::text AS flagged_count,
        COUNT(*) FILTER (WHERE r.rating = 'not_helpful')::text AS not_helpful_count,
        fa.created_at
      FROM feed_answers fa
      JOIN feed_questions fq ON fq.id = fa.question_id
      JOIN feed_answer_ratings r ON r.answer_id = fa.id
      GROUP BY fa.id, fa.question_id, fq.body, fa.answer_type, fa.body, fa.author_user_id,
               fa.moderation_status, fa.moderation_reason, fa.created_at
      HAVING COUNT(*) FILTER (WHERE r.rating = 'flagged') > 0
      ORDER BY COUNT(*) FILTER (WHERE r.rating = 'flagged') DESC, fa.created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    answerId: row.answer_id,
    questionId: row.question_id,
    questionBody: row.question_body,
    answerType: row.answer_type === 'community' ? 'community' : 'llm',
    answerBody: row.answer_body,
    authorUserId: row.author_user_id,
    moderationStatus:
      row.moderation_status === FEED_MODERATION_STATUS.hidden
        ? FEED_MODERATION_STATUS.hidden
        : FEED_MODERATION_STATUS.accepted,
    moderationReason: (row.moderation_reason as FeedModerationReason | null) ?? null,
    flaggedCount: Number(row.flagged_count ?? 0),
    notHelpfulCount: Number(row.not_helpful_count ?? 0),
    createdAtIso: toIso(row.created_at),
  }));
}

// How many flagged answers are still visible — the number that actually needs attention, as opposed to
// the total ever flagged. Counted in the database so it is never a page-capped undercount.
export async function countPendingFlaggedAnswers(): Promise<number> {
  const result = await queryDb<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total FROM (
        SELECT fa.id
        FROM feed_answers fa
        JOIN feed_answer_ratings r ON r.answer_id = fa.id
        WHERE fa.moderation_status = 'accepted'
        GROUP BY fa.id
        HAVING COUNT(*) FILTER (WHERE r.rating = 'flagged') > 0
      ) pending
    `,
  );
  return Number(result.rows[0]?.total ?? 0);
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
