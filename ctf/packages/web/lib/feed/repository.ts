import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  FEED_ALLOWED_CHANNELS,
  FEED_CHANNEL_TO_ITEM_TYPE,
  FEED_ANSWER_RATINGS,
  FEED_COMMUNITY_CATEGORIES,
  FEED_DEFAULT_PAGE,
  FEED_DEFAULT_PAGE_SIZE,
  FEED_ADMIN_MAX_COMMUNITY_POST_URLS,
  FEED_MAX_BODY_LENGTH,
  FEED_MAX_COMMUNITY_POST_LENGTH,
  FEED_MAX_COMMUNITY_POST_URLS,
  FEED_MAX_COMMUNITY_REPLY_LENGTH,
  FEED_MAX_PAGE_SIZE,
  FEED_MAX_QUESTION_LENGTH,
  FEED_MAX_TITLE_LENGTH,
  FEED_MODERATION_STATUS,
  FEED_SYSTEM_ACTOR_ID,
  FEED_QUESTION_CATEGORIES,
  FEED_REACTION_EMOJIS,
  isAllowedFeedReactionEmoji,
} from './constants';
import {
  COMMONS_NOTICES,
  claimGuidanceMilestone,
  dueMilestoneFor,
  stampGuidanceAnnouncement,
} from './commons-guidance';
import { extractMentionHandles, feedAuthorHandle, feedMentionTokens } from './author-handle';
import { normalizeMultilineText } from './normalize';
import { generateFeedAssistedAnswer, inferFeedQuestionCategory } from './inference';
import { emitFeedMembershipEventToStream } from './stream';
import { getPluginBySlug, getPluginRoute, isAdminOnlyPlugin } from 'lib/plugins/repository';
import { notifySafe } from 'lib/notifications/repository';
import { resolveMentionUserIds } from 'lib/identity/resolve-mention-user-ids';
import { reportError } from 'lib/observability/report';

// Re-exported so existing server callers can keep importing them from the feed
// repository; the implementations live in the client-safe ./author-handle module.
export { feedAuthorHandle, feedMentionTokens };
import type {
  Announcement,
  AnnouncementDraftInput,
  AnnouncementTargeting,
  FeedAnswer,
  FeedAnswerRatingValue,
  FeedChannel,
  FeedCommunityCategory,
  FeedCommunityDetail,
  FeedCommunityPostInput,
  FeedCommunityReply,
  FeedAnnouncementReply,
  FeedAnnouncementDetail,
  FeedQuotedPost,
  FeedReactionSummary,
  FeedConfig,
  FeedConfigInput,
  FeedEnabledChannel,
  FeedLocationContext,
  FeedPagination,
  FeedQuestionCategory,
  FeedQuestionDetail,
  FeedQuestionInput,
  FeedTimelineItem,
  MembershipEventType,
  PublicCommunityPost,
} from 'lib/shared/feed-primitives/types';

type FeedConfigRow = {
  render_mode: 'card_only' | 'card_toast';
  max_timeline_page_size: number;
  enabled_channels: unknown;
  is_public: boolean;
  updated_by_user_id: string;
  updated_at: Date;
};

type FeedTimelineRow = {
  id: string;
  item_type: 'announcement' | 'question' | 'community';
  source_announcement_id: string | null;
  source_question_id: string | null;
  source_community_post_id: string | null;
  title: string;
  body: string;
  published_at: Date;
  expires_at: Date | null;
  is_read: boolean;
  is_dismissed: boolean;
};

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  schedule_at: Date | null;
  published_at: Date | null;
  expires_at: Date | null;
  targeting: AnnouncementTargeting;
  linked_plugin_slug: string | null;
  linked_plugin_slugs: unknown;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type CountRow = { total: string };

type FeedQuestionRow = {
  id: string;
  asked_by_user_id: string;
  body: string;
  category: FeedQuestionCategory;
  location_context: unknown;
  llm_consent_granted: boolean;
  created_at: Date;
};

type FeedAnswerRow = {
  id: string;
  question_id: string;
  answer_type: 'llm' | 'community';
  body: string;
  confidence: string | null;
  model_id: string | null;
  sources: unknown;
  author_user_id: string | null;
  created_at: Date;
};

type FeedAnswerRatingRow = {
  answer_id: string;
  rating: FeedAnswerRatingValue;
  total: string;
};

type FeedCommunityPostRow = {
  id: string;
  author_user_id: string;
  author_username: string | null;
  body: string;
  category: FeedCommunityCategory;
  reply_count: number;
  reply_to_post_id: string | null;
  created_at: Date;
};

// Max length of the quoted-post snippet carried to the client for a Signal-style reply.
const FEED_QUOTE_SNIPPET_MAX_LENGTH = 120;

function buildQuoteSnippet(body: string): string {
  const normalized = normalizeText(body);
  if (normalized.length <= FEED_QUOTE_SNIPPET_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, FEED_QUOTE_SNIPPET_MAX_LENGTH - 1).trimEnd()}…`;
}

function quotedAuthorLabel(username: string | null, userId: string | null): string {
  return feedAuthorHandle(username, userId);
}

type FeedCommunityReplyRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  body: string;
  created_at: Date;
};

type FeedReactionAggregateRow = {
  post_id: string;
  emoji: string;
  count: string;
  reacted: boolean;
};

type AnnouncementReactionAggregateRow = {
  announcement_id: string;
  emoji: string;
  count: string;
  reacted: boolean;
};

type AnnouncementReplyCountRow = {
  announcement_id: string;
  count: string;
};

type AnnouncementReplyRow = {
  id: string;
  announcement_id: string;
  author_user_id: string;
  author_username: string | null;
  body: string;
  edited_at: Date | null;
  created_at: Date;
};

// Order a post's reaction summaries by the fixed reaction set so the chips render in a stable,
// predictable order regardless of how rows came back from the database.
function orderReactionsByFixedSet(summaries: FeedReactionSummary[]): FeedReactionSummary[] {
  const rank = new Map<string, number>(FEED_REACTION_EMOJIS.map((emoji, index) => [emoji, index]));
  return [...summaries].sort((a, b) => (rank.get(a.emoji) ?? 999) - (rank.get(b.emoji) ?? 999));
}

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// Like normalizeText but keeps paragraph/line breaks: it collapses only *horizontal* whitespace
// (spaces/tabs) within each line, trims each line, and caps runs of blank lines at one — so a
// member's multi-paragraph message keeps its structure instead of collapsing into one wall of text.
// Used for conversational bodies (community posts, replies, announcements); the render side pairs
// this with `white-space: pre-wrap`.
//
// The implementation moved to lib/feed/normalize.ts so the composer's character counter can import
// it in the browser (this module pulls in the database client and cannot be bundled client-side).
// Re-exported under the original name so every existing call site here is unchanged — and, more to
// the point, so the counter and the server's length check can never drift apart.

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function isValidIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Return the trimmed value only when it is a well-formed UUID, else null. Exported so route handlers
// can reject a malformed path/id (e.g. an arbitrarily long postId) before it reaches the repository.
export function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized));
}

function normalizeTargeting(targeting: unknown): AnnouncementTargeting {
  if (!targeting || typeof targeting !== 'object') {
    return {};
  }

  const target = targeting as { roles?: unknown; plugins?: unknown; regions?: unknown };

  return {
    roles: normalizeStringArray(target.roles),
    plugins: normalizeStringArray(target.plugins),
    regions: normalizeStringArray(target.regions),
  };
}

function normalizeEnabledChannels(value: unknown): FeedEnabledChannel[] {
  const normalized = normalizeStringArray(value).filter(
    (item): item is FeedEnabledChannel => FEED_ALLOWED_CHANNELS.includes(item as FeedEnabledChannel),
  );

  return normalized.length > 0 ? normalized : [...FEED_ALLOWED_CHANNELS];
}

function normalizeCommunityCategory(value: unknown): FeedCommunityCategory {
  return FEED_COMMUNITY_CATEGORIES.includes(value as FeedCommunityCategory)
    ? (value as FeedCommunityCategory)
    : 'general';
}

function normalizeLocationContext(value: unknown): FeedLocationContext | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const location = value as { zipCode?: unknown; radiusMiles?: unknown };
  const zipCode = typeof location.zipCode === 'string' ? normalizeText(location.zipCode) : '';
  const radiusValue = typeof location.radiusMiles === 'number'
    ? location.radiusMiles
    : Number.parseInt(String(location.radiusMiles ?? ''), 10);

  if (zipCode.length === 0) {
    return null;
  }

  return {
    zipCode,
    radiusMiles: Number.isFinite(radiusValue) && radiusValue > 0 ? radiusValue : null,
  };
}

function normalizeAnswerSources(value: unknown): FeedAnswer['sources'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const source = item as { id?: unknown; label?: unknown; detail?: unknown };
    if (typeof source.id !== 'string' || typeof source.label !== 'string' || typeof source.detail !== 'string') {
      return [];
    }

    return [{ id: source.id, label: source.label, detail: source.detail }];
  });
}

function mapAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    scheduleAtIso: row.schedule_at ? toIso(row.schedule_at) : null,
    publishedAtIso: row.published_at ? toIso(row.published_at) : null,
    expiresAtIso: row.expires_at ? toIso(row.expires_at) : null,
    targeting: normalizeTargeting(row.targeting),
    linkedPluginSlugs: readLinkedPluginSlugs(row.linked_plugin_slugs, row.linked_plugin_slug),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapFeedConfig(row: FeedConfigRow): FeedConfig {
  return {
    renderMode: row.render_mode,
    maxTimelinePageSize: row.max_timeline_page_size,
    enabledChannels: normalizeEnabledChannels(row.enabled_channels),
    isPublic: row.is_public ?? true,
    updatedByUserId: row.updated_by_user_id,
    updatedAtIso: toIso(row.updated_at),
  };
}

function getQuestionTitle(category: FeedQuestionCategory): string {
  return `${category.charAt(0).toUpperCase()}${category.slice(1)} question`;
}

function getCommunityTitle(category: FeedCommunityCategory): string {
  return `${category.replace(/_/g, ' ')} update`;
}

function passesFeedModeration(text: string, urlCap: number = FEED_MAX_COMMUNITY_POST_URLS): boolean {
  if (text.length === 0) {
    return false;
  }

  if (/[<>]/.test(text)) {
    return false;
  }

  const urlCount = (text.match(/https?:\/\//g) ?? []).length;
  return urlCount <= urlCap;
}

// The (table, actor-column) pairs this rate-limit query is allowed to run against. Both identifiers
// are looked up from this frozen map — never interpolated from the caller — so even if the parameter
// type widened or a cast slipped a hostile string past the compiler, only these fixed identifiers can
// ever reach the SQL string. Value literals stay parameterized ($1/$2); table and column names cannot
// be parameters in SQL, so an allow-list is the safe form.
const FEED_RATE_LIMIT_TABLES = {
  feed_questions: 'asked_by_user_id',
  feed_community_posts: 'author_user_id',
  feed_community_replies: 'author_user_id',
  announcement_replies: 'author_user_id',
} as const;

async function evaluateFeedRateLimit(
  client: PoolClient,
  input: {
    userId: string;
    tableName: keyof typeof FEED_RATE_LIMIT_TABLES;
    limit: number;
    windowMinutes: number;
  },
): Promise<boolean> {
  const actorColumn = FEED_RATE_LIMIT_TABLES[input.tableName];
  if (!actorColumn) {
    throw new Error('invalid_rate_limit_table');
  }
  const result = await client.query<CountRow>(
    `
      SELECT COUNT(*)::text AS total
      FROM ${input.tableName}
      WHERE ${actorColumn} = $1
        AND created_at >= NOW() - ($2::text || ' minutes')::interval
    `,
    [input.userId, String(input.windowMinutes)],
  );

  return Number.parseInt(result.rows[0]?.total ?? '0', 10) < input.limit;
}

async function nextAnnouncementRevision(client: PoolClient, announcementId: string): Promise<number> {
  const result = await client.query<{ max_revision: number | null }>(
    `
      SELECT MAX(revision_number) AS max_revision
      FROM announcement_revisions
      WHERE announcement_id = $1::uuid
    `,
    [announcementId],
  );

  const maxRevision = result.rows[0]?.max_revision ?? 0;
  return maxRevision + 1;
}

async function upsertFeedTargets(
  client: PoolClient,
  feedItemId: string,
  targeting: AnnouncementTargeting,
): Promise<void> {
  await client.query('DELETE FROM feed_item_targets WHERE item_id = $1::uuid', [feedItemId]);

  const targetRoles = targeting.roles && targeting.roles.length > 0 ? targeting.roles : ['member'];
  const targetPlugins = targeting.plugins && targeting.plugins.length > 0 ? targeting.plugins : [null];
  const targetRegions = targeting.regions && targeting.regions.length > 0 ? targeting.regions : [null];

  for (const role of targetRoles) {
    for (const plugin of targetPlugins) {
      for (const region of targetRegions) {
        await client.query(
          `
            INSERT INTO feed_item_targets (item_id, target_role, target_plugin, target_region)
            VALUES ($1::uuid, $2, $3, $4)
            ON CONFLICT (item_id, target_role, target_plugin, target_region)
            DO NOTHING
          `,
          [feedItemId, role, plugin, region],
        );
      }
    }
  }
}

async function upsertDefaultFeedTargets(client: PoolClient, feedItemId: string): Promise<void> {
  await upsertFeedTargets(client, feedItemId, { roles: ['member', 'admin'] });
}

async function syncFeedItemForAnnouncement(
  client: PoolClient,
  actorId: string,
  announcement: Announcement,
): Promise<void> {
  if (announcement.status !== 'published') {
    await client.query(
      `
        UPDATE feed_items
        SET is_active = FALSE, updated_by_user_id = $2, updated_at = NOW()
        WHERE source_announcement_id = $1::uuid
      `,
      [announcement.id, actorId],
    );
    return;
  }

  // Compose the reader-facing body: the author's text plus an "Open <Plugin>: <url>" line when a
  // valid plugin is linked, so a reader can go straight to the referenced app from wherever the
  // announcement shows (mobile feed, Commons). Recomposed from the clean announcement body each
  // publish, so re-publishing never stacks duplicate link lines.
  const feedBody = await composeAnnouncementFeedBody(announcement.body, announcement.linkedPluginSlugs);

  const feedItemResult = await client.query<{ id: string }>(
    `
      INSERT INTO feed_items
        (item_type, source_announcement_id, title, body, published_at, expires_at, is_active, created_by_user_id, updated_by_user_id)
      VALUES
        ('announcement', $1::uuid, $2, $3, COALESCE($4::timestamptz, NOW()), $5::timestamptz, TRUE, $6, $6)
      ON CONFLICT (source_announcement_id)
      DO UPDATE SET
        item_type = EXCLUDED.item_type,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        published_at = EXCLUDED.published_at,
        expires_at = EXCLUDED.expires_at,
        is_active = TRUE,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING id
    `,
    [
      announcement.id,
      announcement.title,
      feedBody,
      announcement.publishedAtIso,
      announcement.expiresAtIso,
      actorId,
    ],
  );

  const feedItemId = feedItemResult.rows[0].id;
  await upsertFeedTargets(client, feedItemId, announcement.targeting);
}

async function syncFeedItemForQuestion(
  client: PoolClient,
  actorId: string,
  questionId: string,
  title: string,
  body: string,
): Promise<void> {
  const feedItemResult = await client.query<{ id: string }>(
    `
      INSERT INTO feed_items
        (item_type, source_question_id, title, body, published_at, is_active, created_by_user_id, updated_by_user_id)
      VALUES
        ('question', $1::uuid, $2, $3, NOW(), TRUE, $4, $4)
      ON CONFLICT (source_question_id)
      DO UPDATE SET
        item_type = EXCLUDED.item_type,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        is_active = TRUE,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING id
    `,
    [questionId, title, body, actorId],
  );

  await upsertDefaultFeedTargets(client, feedItemResult.rows[0].id);
}

// Bring every already-published standing notice back in line with its current wording.
//
// Matches on the notice's title, which is its stable identity — the bodies change, the titles do not.
// Only ever updates rows authored by the reserved system actor, so an owner-written announcement that
// happens to share a title can never be overwritten.
async function refreshPublishedGuidanceNotices(client: PoolClient): Promise<void> {
  for (const notice of COMMONS_NOTICES) {
    // Updates the announcement and its projected feed row together; a mismatch between the two is what
    // makes the Commons show text that no longer exists anywhere else.
    await client.query(
      `
        UPDATE announcements
        SET body = $2, updated_at = NOW()
        WHERE title = $1 AND created_by_user_id = $3 AND body <> $2
      `,
      [notice.title, notice.body, FEED_SYSTEM_ACTOR_ID],
    );
    await client.query(
      `
        UPDATE feed_items
        SET body = $2, updated_at = NOW()
        WHERE title = $1 AND created_by_user_id = $3 AND item_type = 'announcement' AND body <> $2
      `,
      [notice.title, notice.body, FEED_SYSTEM_ACTOR_ID],
    );
  }
}

// Publish any of the standing Commons notices whose cadence is due on this post.
//
// Never throws: a failure here must not lose the member's post. A notice is a reminder, and missing one
// is a smaller harm than a rejected post — but the claim and the notice do share the post's transaction,
// so the two can never disagree about whether a period was served.
async function maybePostCommonsGuidance(client: PoolClient): Promise<void> {
  try {
    // Counts every community post, hidden ones included. A milestone means "the Commons has seen this
    // much traffic", and moderation after the fact should not shift where the next notice falls.
    const counted = await client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM feed_community_posts');
    const total = Number(counted.rows[0]?.total ?? 0);
    const nowMs = Date.now();

    // Repair notices already published under older wording before considering new ones.
    //
    // These are system-authored standing messages, so the constant in commons-guidance.ts is the source
    // of truth and a published row that disagrees with it is simply out of date. This matters beyond
    // tidiness: the first version of these bodies was authored as source-wrapped lines joined with '\n',
    // which rendered as hard breaks mid-sentence in front of members. Fixing the constant alone would
    // have left every already-published row broken until its next milestone came round — which for the
    // 21-day notice is three weeks. Nothing here touches member-authored content.
    await refreshPublishedGuidanceNotices(client);

    for (const notice of COMMONS_NOTICES) {
      const milestone = dueMilestoneFor(notice, { postCount: total, nowMs });
      if (milestone === null) {
        continue;
      }

      // The claim is the gate. For a time cadence every post inside the interval computes the same
      // period, so all but the first lose this race and skip — which is exactly what makes a "every few
      // weeks" notice fire once per interval rather than on every post in it.
      const won = await claimGuidanceMilestone(client, milestone, notice.key);
      if (!won) {
        continue;
      }

      // Published straight away rather than as a draft — nobody is going to hand-publish these on a
      // schedule, and a draft that never ships is the same as no notice at all.
      const announcement = await client.query<{ id: string }>(
        `
          INSERT INTO announcements
            (title, body, status, published_at, targeting, linked_plugin_slugs, created_by_user_id, updated_by_user_id)
          VALUES
            ($1, $2, 'published', NOW(), $3::jsonb, '[]'::jsonb, $4, $4)
          RETURNING id
        `,
        [notice.title, notice.body, JSON.stringify({ roles: ['member', 'admin'] }), FEED_SYSTEM_ACTOR_ID],
      );

      const announcementId = announcement.rows[0].id;
      await client.query(
        `
          INSERT INTO feed_items
            (item_type, source_announcement_id, title, body, published_at, is_active, created_by_user_id, updated_by_user_id)
          VALUES
            ('announcement', $1::uuid, $2, $3, NOW(), TRUE, $4, $4)
          ON CONFLICT (source_announcement_id) DO NOTHING
        `,
        [announcementId, notice.title, notice.body, FEED_SYSTEM_ACTOR_ID],
      );

      const projected = await client.query<{ id: string }>(
        'SELECT id FROM feed_items WHERE source_announcement_id = $1::uuid LIMIT 1',
        [announcementId],
      );
      if (projected.rows[0]) {
        await upsertDefaultFeedTargets(client, projected.rows[0].id);
      }

      await stampGuidanceAnnouncement(client, milestone, announcementId, notice.key);
    }
  } catch (error) {
    reportError(error, { area: 'feed', op: 'commons_guidance_autopost' });
  }
}

async function syncFeedItemForCommunityPost(
  client: PoolClient,
  actorId: string,
  postId: string,
  title: string,
  body: string,
): Promise<void> {
  const feedItemResult = await client.query<{ id: string }>(
    `
      INSERT INTO feed_items
        (item_type, source_community_post_id, title, body, published_at, is_active, created_by_user_id, updated_by_user_id)
      VALUES
        ('community', $1::uuid, $2, $3, NOW(), TRUE, $4, $4)
      ON CONFLICT (source_community_post_id)
      DO UPDATE SET
        item_type = EXCLUDED.item_type,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        is_active = TRUE,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING id
    `,
    [postId, title, body, actorId],
  );

  await upsertDefaultFeedTargets(client, feedItemResult.rows[0].id);
}

function mapAnswerRows(
  answerRows: FeedAnswerRow[],
  ratingRows: FeedAnswerRatingRow[],
  currentUserRatings: Map<string, FeedAnswerRatingValue>,
): Map<string, FeedAnswer[]> {
  const ratingsByAnswer = new Map<string, Record<FeedAnswerRatingValue, number>>();
  for (const rating of ratingRows) {
    const current = ratingsByAnswer.get(rating.answer_id) ?? { helpful: 0, not_helpful: 0, flagged: 0 };
    current[rating.rating] = Number.parseInt(rating.total, 10);
    ratingsByAnswer.set(rating.answer_id, current);
  }

  const answersByQuestion = new Map<string, FeedAnswer[]>();
  for (const row of answerRows) {
    const current = answersByQuestion.get(row.question_id) ?? [];
    current.push({
      id: row.id,
      questionId: row.question_id,
      answerType: row.answer_type,
      body: row.body,
      confidence: row.confidence === null ? null : Number.parseFloat(row.confidence),
      modelId: row.model_id,
      sources: normalizeAnswerSources(row.sources),
      authorUserId: row.author_user_id,
      ratingSummary: ratingsByAnswer.get(row.id) ?? { helpful: 0, not_helpful: 0, flagged: 0 },
      currentUserRating: currentUserRatings.get(row.id) ?? null,
      createdAtIso: toIso(row.created_at),
    });
    answersByQuestion.set(row.question_id, current);
  }

  return answersByQuestion;
}

export function parsePaginationParams(url: string): { page: number; pageSize: number } {
  const params = new URL(url).searchParams;
  const pageRaw = Number.parseInt(params.get('page') ?? '', 10);
  const pageSizeRaw = Number.parseInt(params.get('pageSize') ?? '', 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : FEED_DEFAULT_PAGE;
  const pageSizeBase = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : FEED_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(pageSizeBase, FEED_MAX_PAGE_SIZE);

  return { page, pageSize };
}

export function validateFeedConfigInput(input: FeedConfigInput): boolean {
  const renderModeAllowed = input.renderMode === 'card_only' || input.renderMode === 'card_toast';
  const maxPageSizeAllowed = Number.isInteger(input.maxTimelinePageSize)
    && input.maxTimelinePageSize >= 10
    && input.maxTimelinePageSize <= FEED_MAX_PAGE_SIZE;
  const channelsAllowed = !input.enabledChannels
    || input.enabledChannels.every((channel: string) => FEED_ALLOWED_CHANNELS.includes(channel as FeedEnabledChannel));

  return renderModeAllowed && maxPageSizeAllowed && channelsAllowed;
}

export function validateAnnouncementDraftInput(input: AnnouncementDraftInput): boolean {
  const title = normalizeText(input.title ?? '');
  const body = normalizeMultilineText(input.body ?? '');
  const scheduleAt = normalizeNullableText(input.scheduleAtIso);
  const expiresAt = normalizeNullableText(input.expiresAtIso);

  // Targeting is optional in the shipped product: the admin authoring UI has no targeting control
  // and posts drafts without it, meaning "broadcast to everyone" (normalizeTargeting yields {}).
  // An earlier change made targeting mandatory here to satisfy the deprecated announcements command
  // contract, but that broke the real Create-draft flow, so targeting is intentionally not required.
  // When targeting IS supplied it must be a plain object; an array or other non-object is rejected.
  const targeting = input.targeting;
  const targetingOk =
    targeting === undefined
    || (typeof targeting === 'object' && targeting !== null && !Array.isArray(targeting));

  const checks = [
    title.length > 0 && title.length <= FEED_MAX_TITLE_LENGTH,
    body.length > 0 && body.length <= FEED_MAX_BODY_LENGTH,
    !scheduleAt || isValidIsoDatetime(scheduleAt),
    !expiresAt || isValidIsoDatetime(expiresAt),
    targetingOk,
  ];

  return checks.every(Boolean);
}

export function validateFeedQuestionInput(input: FeedQuestionInput): boolean {
  const body = normalizeText(input.body ?? '');
  return body.length > 0
    && body.length <= FEED_MAX_QUESTION_LENGTH
    && typeof input.consentGranted === 'boolean';
}

export function validateFeedCommunityPostInput(
  input: FeedCommunityPostInput,
  maxLength: number = FEED_MAX_COMMUNITY_POST_LENGTH,
): boolean {
  // Measure the multiline-normalized body (the same shape that gets stored) so the length check
  // matches what is actually saved now that line breaks are preserved.
  const body = normalizeMultilineText(input.body ?? '');
  const bodyOk = body.length > 0 && body.length <= maxLength;
  // replyToPostId is optional; when present it must be null or a well-formed UUID. The
  // referenced post's existence is checked inside the transaction in createFeedCommunityPost.
  const replyOk = input.replyToPostId === undefined
    || input.replyToPostId === null
    || normalizeUuid(input.replyToPostId) !== null;
  return bodyOk && replyOk;
}

export function validateFeedCommunityReplyBody(body: string): boolean {
  const normalized = normalizeMultilineText(body);
  return normalized.length > 0 && normalized.length <= FEED_MAX_COMMUNITY_REPLY_LENGTH;
}

export async function getFeedConfig(): Promise<FeedConfig> {
  const result = await queryDb<FeedConfigRow>(
    `
      SELECT render_mode, max_timeline_page_size, enabled_channels, is_public, updated_by_user_id, updated_at
      FROM feed_render_config
      WHERE singleton_key = TRUE
      LIMIT 1
    `,
  );

  if (result.rows.length === 0) {
    throw new Error('feed_config_not_found');
  }

  return mapFeedConfig(result.rows[0]);
}

// Read-only Commons for signed-out visitors. Community (peer) posts are public the way Quora posts
// are, so an anonymous visitor can read them — but only community posts (never announcements or AI
// Q&A), and only when an admin has turned public viewing on (feed_render_config.is_public) and the
// community channel is enabled. Returns `isPublic: false` (and no posts) when public viewing is off,
// the config row is missing, or community is disabled — the caller then shows the sign-in prompt
// instead. Mirrors the member-visible filter (active, published, not expired, targeted to the
// general audience) but carries no per-user state and no author user id.
export async function listPublicCommunityPosts(
  limit = FEED_DEFAULT_PAGE_SIZE,
): Promise<{ isPublic: boolean; posts: PublicCommunityPost[] }> {
  const safeLimit = Math.min(Math.max(limit, 1), FEED_MAX_PAGE_SIZE);

  let config: FeedConfig | null = null;
  try {
    config = await getFeedConfig();
  } catch {
    config = null;
  }

  if (!config || !config.isPublic || !config.enabledChannels.includes('community')) {
    return { isPublic: false, posts: [] };
  }

  const result = await queryDb<{
    id: string;
    author_username: string | null;
    body: string;
    category: FeedCommunityCategory;
    created_at: Date;
  }>(
    `
      SELECT c.id, c.author_username, c.body, c.category, c.created_at
      FROM feed_items f
      JOIN feed_community_posts c ON c.id = f.source_community_post_id
      WHERE f.item_type = 'community'
        AND f.is_active = TRUE
        AND c.moderation_status = 'accepted'
        AND f.published_at <= NOW()
        AND (f.expires_at IS NULL OR f.expires_at > NOW())
        AND EXISTS (
          SELECT 1
          FROM feed_item_targets t
          WHERE t.item_id = f.id
            AND t.target_role IN ('member', 'admin', 'all')
        )
      ORDER BY f.published_at DESC, f.id DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  const posts: PublicCommunityPost[] = result.rows.map((row) => ({
    id: row.id,
    authorUsername: row.author_username,
    body: row.body,
    category: row.category,
    createdAtIso: toIso(row.created_at),
  }));

  return { isPublic: true, posts };
}

export async function updateFeedConfig(actorId: string, input: FeedConfigInput): Promise<FeedConfig> {
  const enabledChannels = normalizeEnabledChannels(input.enabledChannels);
  const result = await queryDb<FeedConfigRow>(
    `
      UPDATE feed_render_config
      SET
        render_mode = $1,
        max_timeline_page_size = $2,
        enabled_channels = $3::jsonb,
        updated_by_user_id = $4,
        updated_at = NOW()
      WHERE singleton_key = TRUE
      RETURNING render_mode, max_timeline_page_size, enabled_channels, is_public, updated_by_user_id, updated_at
    `,
    [input.renderMode, input.maxTimelinePageSize, JSON.stringify(enabledChannels), actorId],
  );

  if (result.rows.length === 0) {
    throw new Error('feed_config_not_found');
  }

  return mapFeedConfig(result.rows[0]);
}

// Escape the characters LIKE/ILIKE treats specially (backslash, percent, underscore)
// so a member handle is always matched literally inside the parameterized pattern.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Shared query filter values for the feed timeline. Derived once per request from the actor's role
// and the requested channel/plugin/mention filters, then reused by the count, "load around", and
// main timeline queries so all three share exactly the same visibility filter.
type FeedTimelineQueryParams = {
  actorRole: string;
  pluginFilter: string | null;
  allowedItemTypes: FeedTimelineRow['item_type'][];
  mentionPatterns: string[] | null;
};

// Load the singleton feed render config for the timeline read. Returns the mapped config, or null
// when the config row is missing (the caller then falls back to the full allowed channel set).
async function loadFeedTimelineConfig(client: PoolClient): Promise<FeedConfig | null> {
  const config = await client.query<FeedConfigRow>(
    `
        SELECT render_mode, max_timeline_page_size, enabled_channels, is_public, updated_by_user_id, updated_at
        FROM feed_render_config
        WHERE singleton_key = TRUE
        LIMIT 1
      `,
  );

  return config.rows[0] ? mapFeedConfig(config.rows[0]) : null;
}

// Resolve the shared visibility filter for the timeline read from the actor's role and the requested
// channel/plugin/mention filters. Channel names are plural; feed_items.item_type is singular, so the
// requested channels are mapped to item types. Mentions become LIKE-escaped `%@handle%` patterns
// matched with ILIKE ANY; null disables the filter entirely.
function resolveFeedTimelineQueryParams(
  role: string | null,
  filters: {
    pluginId?: string | null;
    channel?: FeedChannel;
    mentionHandles?: string[] | null;
  },
  enabledChannels: FeedEnabledChannel[],
): FeedTimelineQueryParams {
  const actorRole = role ?? 'member';
  const pluginFilter = normalizeNullableText(filters.pluginId);
  const requestedChannel = filters.channel ?? 'all';
  const allowedChannels = requestedChannel === 'all'
    ? enabledChannels
    : enabledChannels.filter((channel: string) => channel === requestedChannel);
  const allowedItemTypes = allowedChannels.map((channel) => FEED_CHANNEL_TO_ITEM_TYPE[channel]);
  const mentionHandles = (filters.mentionHandles ?? []).filter((handle) => handle.length > 0);
  const mentionPatterns = mentionHandles.length > 0
    ? mentionHandles.map((handle) => `%${escapeLikePattern(handle)}%`)
    : null;

  return { actorRole, pluginFilter, allowedItemTypes, mentionPatterns };
}

// Count the timeline items visible under the shared filter, for pagination totals.
// Hides a community post authored by a member who is blocked (either direction) relative to the
// viewer (issue #809 task 4) — the Commons must not show a blocked person's posts. Announcements and
// AI Q&A items have no member author and pass through (`source_community_post_id IS NULL`). The
// placeholder holds the viewer id; count and page queries number their arguments differently.
function hideBlockedCommunityAuthorsSql(viewer: string): string {
  return `
          AND (
            f.source_community_post_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM feed_community_posts p
              JOIN member_blocks mb
                ON (mb.blocker_user_id = ${viewer} AND mb.blocked_user_id = p.author_user_id)
                OR (mb.blocker_user_id = p.author_user_id AND mb.blocked_user_id = ${viewer})
              WHERE p.id = f.source_community_post_id
            )
          )`;
}

// Hide a Commons post or AI Q&A card whose source row is gone.
//
// A community/question item in `feed_items` is only ever a COPY of a row in `feed_community_posts` /
// `feed_questions`, carrying the same text. When the source row went away but the copy did not, the
// copy kept rendering the member's words with no author to resolve, so the read path fell back to the
// pseudonym built from the placeholder id (`user-hub-syst`) — a deleted post reappearing under a
// generic name (owner report, 2026-08-09). Account deletion now removes the copy too, and schema.sql
// clears the ones already left behind; this guard is the standing safeguard so no other path can put
// a member's deleted words back on screen. Announcement items carry neither source id and pass
// straight through.
const HIDE_ORPHANED_SOURCE_ROWS_SQL = `
          AND (
            f.source_community_post_id IS NULL
            OR EXISTS (SELECT 1 FROM feed_community_posts p WHERE p.id = f.source_community_post_id)
          )
          AND (
            f.source_question_id IS NULL
            OR EXISTS (SELECT 1 FROM feed_questions q WHERE q.id = f.source_question_id)
          )`;

async function countFeedTimeline(client: PoolClient, params: FeedTimelineQueryParams, viewerUserId: string): Promise<number> {
  const count = await client.query<CountRow>(
    `
        SELECT COUNT(*)::text AS total
        FROM feed_items f
        WHERE f.is_active = TRUE
          AND f.published_at <= NOW()
          AND (f.expires_at IS NULL OR f.expires_at > NOW())
          AND f.item_type = ANY($3::text[])
          AND ($4::text[] IS NULL OR f.body ILIKE ANY($4::text[]))
          AND EXISTS (
            SELECT 1
            FROM feed_item_targets t
            WHERE t.item_id = f.id
              AND t.target_role IN ($1, 'member', 'admin', 'all')
              AND ($2::text IS NULL OR t.target_plugin IS NULL OR t.target_plugin = $2)
          )${hideBlockedCommunityAuthorsSql('$5')}${HIDE_ORPHANED_SOURCE_ROWS_SQL}
      `,
    [params.actorRole, params.pluginFilter, params.allowedItemTypes, params.mentionPatterns, viewerUserId],
  );

  return Number.parseInt(count.rows[0]?.total ?? '0', 10);
}

// Resolve the deep-link "load around" target to a { column, value } pair, or null when neither a
// community post nor an announcement id is supplied (both absent, malformed, or filtered out). The
// community post form wins when both are somehow set — the same precedence the timeline used inline.
function resolveAroundTarget(
  aroundCommunityPostId: string | null | undefined,
  aroundAnnouncementId: string | null | undefined,
): { column: 'source_community_post_id' | 'source_announcement_id'; value: string } | null {
  const communityId = normalizeUuid(aroundCommunityPostId ?? null);
  const announcementId = communityId ? null : normalizeUuid(aroundAnnouncementId ?? null);
  if (communityId) {
    return { column: 'source_community_post_id', value: communityId };
  }
  if (announcementId) {
    return { column: 'source_announcement_id', value: announcementId };
  }
  return null;
}

// Deep-link "load around": center the page on the target item so a notification's "Open" lands on a
// message older than the recent page. Resolve the target feed item, count how many items are newer
// than it under the same visibility filters (its 0-indexed rank in the DESC ordering), then offset
// back by half a page so the target sits mid-window. Falls back to the normal page when the target
// is not found (deleted, expired, or outside this member's visibility).
async function resolveEffectiveOffset(
  client: PoolClient,
  options: {
    offset: number;
    pageSize: number;
    aroundCommunityPostId: string | null | undefined;
    aroundAnnouncementId: string | null | undefined;
    params: FeedTimelineQueryParams;
    viewerUserId: string;
  },
): Promise<number> {
  const around = resolveAroundTarget(options.aroundCommunityPostId, options.aroundAnnouncementId);
  if (!around) {
    return options.offset;
  }

  const targetRes = await client.query<{ id: string; published_at: Date }>(
    `
          SELECT id, published_at
          FROM feed_items
          WHERE is_active = TRUE
            AND published_at <= NOW()
            AND (expires_at IS NULL OR expires_at > NOW())
            AND ${around.column} = $1::uuid
          ORDER BY published_at DESC, id DESC
          LIMIT 1
        `,
    [around.value],
  );
  const target = targetRes.rows[0];
  if (!target) {
    return options.offset;
  }

  const { params } = options;
  const rankRes = await client.query<{ rank: string }>(
    `
            SELECT COUNT(*)::text AS rank
            FROM feed_items f
            WHERE f.is_active = TRUE
              AND f.published_at <= NOW()
              AND (f.expires_at IS NULL OR f.expires_at > NOW())
              AND f.item_type = ANY($3::text[])
              AND ($4::text[] IS NULL OR f.body ILIKE ANY($4::text[]))
              AND EXISTS (
                SELECT 1
                FROM feed_item_targets t
                WHERE t.item_id = f.id
                  AND t.target_role IN ($1, 'member', 'admin', 'all')
                  AND ($2::text IS NULL OR t.target_plugin IS NULL OR t.target_plugin = $2)
              )
              AND (f.published_at > $5 OR (f.published_at = $5 AND f.id > $6::uuid))${hideBlockedCommunityAuthorsSql('$7')}${HIDE_ORPHANED_SOURCE_ROWS_SQL}
          `,
    [params.actorRole, params.pluginFilter, params.allowedItemTypes, params.mentionPatterns, target.published_at, target.id, options.viewerUserId],
  );
  const rank = Number.parseInt(rankRes.rows[0]?.rank ?? '0', 10);
  return Math.max(0, rank - Math.floor(options.pageSize / 2));
}

// Run the main timeline query: the page of feed items visible under the shared filter, with the
// requesting member's per-item read/dismissed state joined in. Returns the raw rows in feed order.
async function queryFeedTimelineRows(
  client: PoolClient,
  options: {
    userId: string;
    params: FeedTimelineQueryParams;
    effectiveOffset: number;
    pageSize: number;
  },
): Promise<FeedTimelineRow[]> {
  const { params } = options;
  const result = await client.query<FeedTimelineRow>(
    `
        SELECT
          f.id,
          f.item_type,
          f.source_announcement_id,
          f.source_question_id,
          f.source_community_post_id,
          f.title,
          f.body,
          f.published_at,
          f.expires_at,
          fr.user_id IS NOT NULL AS is_read,
          fd.user_id IS NOT NULL AS is_dismissed
        FROM feed_items f
        LEFT JOIN feed_user_read_state fr
          ON fr.item_id = f.id AND fr.user_id = $4
        LEFT JOIN feed_user_dismissals fd
          ON fd.item_id = f.id AND fd.user_id = $4
        WHERE f.is_active = TRUE
          AND f.published_at <= NOW()
          AND (f.expires_at IS NULL OR f.expires_at > NOW())
          AND f.item_type = ANY($3::text[])
          AND ($7::text[] IS NULL OR f.body ILIKE ANY($7::text[]))
          AND EXISTS (
            SELECT 1
            FROM feed_item_targets t
            WHERE t.item_id = f.id
              AND t.target_role IN ($1, 'member', 'admin', 'all')
              AND ($2::text IS NULL OR t.target_plugin IS NULL OR t.target_plugin = $2)
          )${hideBlockedCommunityAuthorsSql('$4')}${HIDE_ORPHANED_SOURCE_ROWS_SQL}
        ORDER BY f.published_at DESC, f.id DESC
        OFFSET $5 LIMIT $6
      `,
    [params.actorRole, params.pluginFilter, params.allowedItemTypes, options.userId, options.effectiveOffset, options.pageSize, params.mentionPatterns],
  );

  return result.rows;
}

// Collect the distinct source ids referenced by a page of timeline rows, split by kind, so each
// detail set (questions, community posts, announcements) can be batch-loaded.
function collectTimelineSourceIds(rows: FeedTimelineRow[]): {
  questionIds: string[];
  communityIds: string[];
  announcementIds: string[];
} {
  const questionIds = rows.flatMap((row) => (row.source_question_id ? [row.source_question_id] : []));
  const communityIds = rows.flatMap((row) => (row.source_community_post_id ? [row.source_community_post_id] : []));
  const announcementIds = rows.flatMap((row) =>
    row.item_type === 'announcement' && row.source_announcement_id ? [row.source_announcement_id] : [],
  );

  return { questionIds, communityIds, announcementIds };
}

// Batch-load the question detail (body, category, location, and answers with rating summaries and
// the requesting member's own rating) for the questions on this timeline page. Keyed by question id.
async function loadQuestionDetails(
  client: PoolClient,
  questionIds: string[],
  userId: string,
): Promise<Map<string, FeedQuestionDetail>> {
  const questionDetails = new Map<string, FeedQuestionDetail>();
  if (questionIds.length === 0) {
    return questionDetails;
  }

  const [questionRows, answerRows, ratingRows, currentUserRatings] = await Promise.all([
    client.query<FeedQuestionRow>(
      `
            SELECT id, asked_by_user_id, body, category, location_context, llm_consent_granted, created_at
            FROM feed_questions
            WHERE id = ANY($1::uuid[])
              AND moderation_status = 'accepted'
          `,
      [questionIds],
    ),
    client.query<FeedAnswerRow>(
      `
            SELECT id, question_id, answer_type, body, confidence::text, model_id, sources, author_user_id, created_at
            FROM feed_answers
            WHERE question_id = ANY($1::uuid[])
              AND moderation_status = 'accepted'
            ORDER BY created_at ASC
          `,
      [questionIds],
    ),
    client.query<FeedAnswerRatingRow>(
      `
            SELECT answer_id, rating, COUNT(*)::text AS total
            FROM feed_answer_ratings
            WHERE answer_id IN (
              SELECT id FROM feed_answers WHERE question_id = ANY($1::uuid[])
            )
            GROUP BY answer_id, rating
          `,
      [questionIds],
    ),
    client.query<{ answer_id: string; rating: FeedAnswerRatingValue }>(
      `
            SELECT answer_id, rating
            FROM feed_answer_ratings
            WHERE user_id = $1
              AND answer_id IN (
                SELECT id FROM feed_answers WHERE question_id = ANY($2::uuid[])
              )
          `,
      [userId, questionIds],
    ),
  ]);

  const currentUserRatingMap = new Map(currentUserRatings.rows.map((row) => [row.answer_id, row.rating]));
  const answersByQuestion = mapAnswerRows(answerRows.rows, ratingRows.rows, currentUserRatingMap);

  for (const row of questionRows.rows) {
    const answers = answersByQuestion.get(row.id) ?? [];
    questionDetails.set(row.id, {
      id: row.id,
      body: row.body,
      category: row.category,
      location: normalizeLocationContext(row.location_context),
      llmConsentGranted: row.llm_consent_granted,
      answerCount: answers.length,
      answers,
    });
  }

  return questionDetails;
}

// Build post id → ordered reaction summaries from the batched reaction aggregate rows. Only emojis
// with at least one reaction appear; posts with none get an empty array at render time.
function groupReactionsByPost(reactionRows: FeedReactionAggregateRow[]): Map<string, FeedReactionSummary[]> {
  const reactionsByPost = new Map<string, FeedReactionSummary[]>();
  for (const row of reactionRows) {
    const current = reactionsByPost.get(row.post_id) ?? [];
    current.push({
      emoji: row.emoji,
      count: Number.parseInt(row.count, 10),
      reactedByMe: row.reacted,
    });
    reactionsByPost.set(row.post_id, current);
  }

  return reactionsByPost;
}

// Build post id → ordered replies from the batched reply rows (created_at ascending).
function groupRepliesByPost(replyRows: FeedCommunityReplyRow[]): Map<string, FeedCommunityReply[]> {
  const repliesByPost = new Map<string, FeedCommunityReply[]>();
  for (const row of replyRows) {
    const current = repliesByPost.get(row.post_id) ?? [];
    current.push({
      id: row.id,
      postId: row.post_id,
      body: row.body,
      authorUserId: row.author_user_id,
      createdAtIso: toIso(row.created_at),
    });
    repliesByPost.set(row.post_id, current);
  }

  return repliesByPost;
}

// Resolve each quoted (replied-to) post's author handle and a short snippet of its body. The quoted
// post may sit outside this timeline page, so look up the referenced ids directly. Returns a map
// id → { author, snippet }.
async function loadQuotedPosts(
  client: PoolClient,
  postRows: FeedCommunityPostRow[],
): Promise<Map<string, FeedQuotedPost>> {
  const quotedById = new Map<string, FeedQuotedPost>();
  const quotedIds = Array.from(
    new Set(postRows.flatMap((row) => (row.reply_to_post_id ? [row.reply_to_post_id] : []))),
  );
  if (quotedIds.length === 0) {
    return quotedById;
  }

  const quotedRows = await client.query<{
    id: string;
    author_user_id: string | null;
    author_username: string | null;
    body: string;
  }>(
    `
            SELECT id, author_user_id, author_username, body
            FROM feed_community_posts
            WHERE id = ANY($1::uuid[])
              AND moderation_status = 'accepted'
          `,
    [quotedIds],
  );
  for (const row of quotedRows.rows) {
    quotedById.set(row.id, {
      author: quotedAuthorLabel(row.author_username, row.author_user_id),
      snippet: buildQuoteSnippet(row.body),
    });
  }

  return quotedById;
}

// Assemble a single community post detail from its row plus the pre-grouped reply/reaction/quote maps.
function buildCommunityDetail(
  row: FeedCommunityPostRow,
  maps: {
    repliesByPost: Map<string, FeedCommunityReply[]>;
    reactionsByPost: Map<string, FeedReactionSummary[]>;
    quotedById: Map<string, FeedQuotedPost>;
  },
): FeedCommunityDetail {
  const quotedPost = row.reply_to_post_id ? maps.quotedById.get(row.reply_to_post_id) ?? null : null;
  return {
    id: row.id,
    body: row.body,
    category: row.category,
    authorUserId: row.author_user_id,
    authorUsername: row.author_username,
    replyCount: row.reply_count,
    replies: maps.repliesByPost.get(row.id) ?? [],
    // The foreign key is ON DELETE SET NULL: if the quoted post was deleted, the
    // reference resolves to null and no quote block is rendered.
    replyToPostId: quotedPost ? row.reply_to_post_id : null,
    quotedPost,
    reactions: orderReactionsByFixedSet(maps.reactionsByPost.get(row.id) ?? []),
  };
}

// Batch-load the community post detail (body, author, replies, quoted post, and reaction chips) for
// the community posts on this timeline page. Keyed by community post id.
async function loadCommunityDetails(
  client: PoolClient,
  communityIds: string[],
  userId: string,
): Promise<Map<string, FeedCommunityDetail>> {
  const communityDetails = new Map<string, FeedCommunityDetail>();
  if (communityIds.length === 0) {
    return communityDetails;
  }

  const [postRows, replyRows, reactionRows] = await Promise.all([
    client.query<FeedCommunityPostRow>(
      `
            SELECT id, author_user_id, author_username, body, category, reply_count, reply_to_post_id, created_at
            FROM feed_community_posts
            WHERE id = ANY($1::uuid[])
              AND moderation_status = 'accepted'
          `,
      [communityIds],
    ),
    client.query<FeedCommunityReplyRow>(
      `
            SELECT id, post_id, author_user_id, body, created_at
            FROM feed_community_replies
            WHERE post_id = ANY($1::uuid[])
              AND moderation_status = 'accepted'
              AND NOT EXISTS (
                SELECT 1
                FROM member_blocks mb
                WHERE (mb.blocker_user_id = $2 AND mb.blocked_user_id = feed_community_replies.author_user_id)
                   OR (mb.blocker_user_id = feed_community_replies.author_user_id AND mb.blocked_user_id = $2)
              )
            ORDER BY created_at ASC
          `,
      [communityIds, userId],
    ),
    // Aggregate reactions for every visible community post in one batched query.
    // BOOL_OR(user_id = $2) tells us whether the requesting member reacted with each emoji.
    client.query<FeedReactionAggregateRow>(
      `
            SELECT post_id, emoji, COUNT(*)::text AS count, BOOL_OR(user_id = $2) AS reacted
            FROM feed_community_post_reactions
            WHERE post_id = ANY($1::uuid[])
            GROUP BY post_id, emoji
          `,
      [communityIds, userId],
    ),
  ]);

  const reactionsByPost = groupReactionsByPost(reactionRows.rows);
  const repliesByPost = groupRepliesByPost(replyRows.rows);
  const quotedById = await loadQuotedPosts(client, postRows.rows);

  for (const row of postRows.rows) {
    communityDetails.set(row.id, buildCommunityDetail(row, { repliesByPost, reactionsByPost, quotedById }));
  }

  return communityDetails;
}

// Reaction + reply aggregates for the announcements on this page, resolved for the requesting member
// in two batched queries so each official card can render its reaction chips and a "N replies"
// affordance without extra fetches. Keyed on the announcement id.
async function loadAnnouncementDetails(
  client: PoolClient,
  announcementIds: string[],
  userId: string,
): Promise<Map<string, FeedAnnouncementDetail>> {
  const announcementDetailsById = new Map<string, FeedAnnouncementDetail>();
  if (announcementIds.length === 0) {
    return announcementDetailsById;
  }

  const [reactionRows, replyCountRows] = await Promise.all([
    client.query<AnnouncementReactionAggregateRow>(
      `
            SELECT announcement_id, emoji, COUNT(*)::text AS count, BOOL_OR(user_id = $2) AS reacted
            FROM announcement_reactions
            WHERE announcement_id = ANY($1::uuid[])
            GROUP BY announcement_id, emoji
          `,
      [announcementIds, userId],
    ),
    client.query<AnnouncementReplyCountRow>(
      `
            SELECT announcement_id, COUNT(*)::text AS count
            FROM announcement_replies
            WHERE announcement_id = ANY($1::uuid[])
              AND moderation_status = 'accepted'
            GROUP BY announcement_id
          `,
      [announcementIds],
    ),
  ]);

  const reactionsByAnnouncement = new Map<string, FeedReactionSummary[]>();
  for (const row of reactionRows.rows) {
    const current = reactionsByAnnouncement.get(row.announcement_id) ?? [];
    current.push({
      emoji: row.emoji,
      count: Number.parseInt(row.count, 10),
      reactedByMe: row.reacted,
    });
    reactionsByAnnouncement.set(row.announcement_id, current);
  }

  const replyCountByAnnouncement = new Map<string, number>();
  for (const row of replyCountRows.rows) {
    replyCountByAnnouncement.set(row.announcement_id, Number.parseInt(row.count, 10));
  }

  for (const announcementId of new Set(announcementIds)) {
    announcementDetailsById.set(announcementId, {
      id: announcementId,
      reactions: orderReactionsByFixedSet(reactionsByAnnouncement.get(announcementId) ?? []),
      replyCount: replyCountByAnnouncement.get(announcementId) ?? 0,
    });
  }

  return announcementDetailsById;
}

// Project a raw timeline row into the client-facing FeedTimelineItem, attaching the matching
// pre-loaded question/community/announcement detail (or null when the source is absent).
function buildTimelineItem(
  row: FeedTimelineRow,
  details: {
    questionDetails: Map<string, FeedQuestionDetail>;
    communityDetails: Map<string, FeedCommunityDetail>;
    announcementDetailsById: Map<string, FeedAnnouncementDetail>;
  },
): FeedTimelineItem {
  return {
    id: row.id,
    itemType: row.item_type,
    sourceAnnouncementId: row.source_announcement_id,
    sourceQuestionId: row.source_question_id,
    sourceCommunityPostId: row.source_community_post_id,
    title: row.title,
    body: row.body,
    publishedAtIso: toIso(row.published_at),
    expiresAtIso: row.expires_at ? toIso(row.expires_at) : null,
    isRead: row.is_read,
    isDismissed: row.is_dismissed,
    question: row.source_question_id ? (details.questionDetails.get(row.source_question_id) ?? null) : null,
    community: row.source_community_post_id ? (details.communityDetails.get(row.source_community_post_id) ?? null) : null,
    announcement: row.item_type === 'announcement' && row.source_announcement_id
      ? (details.announcementDetailsById.get(row.source_announcement_id) ?? null)
      : null,
  };
}

export async function listFeedTimeline(
  userId: string,
  role: string | null,
  pagination: { page: number; pageSize: number },
  filters: {
    pluginId?: string | null;
    channel?: FeedChannel;
    // Literal @-handle tokens (e.g. '@farah', '@user-3gysu61f') the item body must
    // contain (case-insensitive, any one of them). Derived server-side from the
    // authenticated user — never from client input. Null/empty means no filter.
    mentionHandles?: string[] | null;
    // Deep-link "load around": when set, the returned page is centered on the feed item that projects
    // this community post / announcement, so a notification can land on a message older than the recent
    // page. Ignored when the item is not found (falls back to the normal page). One or the other, not
    // both — the community post form wins if both are somehow set.
    aroundCommunityPostId?: string | null;
    aroundAnnouncementId?: string | null;
  },
): Promise<{ items: FeedTimelineItem[]; pagination: FeedPagination }> {
  return withDbTransaction(async (client) => {
    const resolvedConfig = await loadFeedTimelineConfig(client);
    const enabledChannels = resolvedConfig?.enabledChannels ?? [...FEED_ALLOWED_CHANNELS];
    const params = resolveFeedTimelineQueryParams(role, filters, enabledChannels);
    const offset = (pagination.page - 1) * pagination.pageSize;

    if (params.allowedItemTypes.length === 0) {
      return {
        items: [],
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: 0,
        },
      };
    }

    const total = await countFeedTimeline(client, params, userId);
    const effectiveOffset = await resolveEffectiveOffset(client, {
      offset,
      pageSize: pagination.pageSize,
      aroundCommunityPostId: filters.aroundCommunityPostId,
      aroundAnnouncementId: filters.aroundAnnouncementId,
      params,
      viewerUserId: userId,
    });

    const rows = await queryFeedTimelineRows(client, {
      userId,
      params,
      effectiveOffset,
      pageSize: pagination.pageSize,
    });

    const { questionIds, communityIds, announcementIds } = collectTimelineSourceIds(rows);

    // These detail loads run sequentially (not in Promise.all) because they share one transaction
    // client, and a single pg client cannot run overlapping queries.
    const questionDetails = await loadQuestionDetails(client, questionIds, userId);
    const communityDetails = await loadCommunityDetails(client, communityIds, userId);
    const announcementDetailsById = await loadAnnouncementDetails(client, announcementIds, userId);

    return {
      items: rows.map((row) =>
        buildTimelineItem(row, { questionDetails, communityDetails, announcementDetailsById }),
      ),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      },
    };
  });
}

// Returns the stored read_at so the route can satisfy the feed.item.read.mark contract, whose
// output schema includes readAt (issue #2017 — the route previously returned only ok/itemId).
export async function markFeedItemRead(
  userId: string,
  itemId: string,
): Promise<{ readAtIso: string }> {
  const result = await queryDb<{ read_at: string }>(
    `
      INSERT INTO feed_user_read_state (user_id, item_id, read_at)
      VALUES ($1, $2::uuid, NOW())
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
      RETURNING read_at
    `,
    [userId, itemId],
  );
  return { readAtIso: new Date(result.rows[0].read_at).toISOString() };
}

// Returns the stored dismissed_at so the route can satisfy the feed.item.dismiss contract, whose
// output schema includes dismissedAt (issue #2016 — the route previously returned only ok/itemId).
export async function dismissFeedItem(
  userId: string,
  itemId: string,
): Promise<{ dismissedAtIso: string }> {
  const result = await queryDb<{ id: string }>(
    'SELECT id FROM feed_items WHERE id = $1::uuid LIMIT 1',
    [itemId],
  );

  if (result.rows.length === 0) {
    throw new Error('feed_item_not_found');
  }

  const dismissed = await queryDb<{ dismissed_at: string }>(
    `
      INSERT INTO feed_user_dismissals (user_id, item_id, dismissed_at)
      VALUES ($1, $2::uuid, NOW())
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at
      RETURNING dismissed_at
    `,
    [userId, itemId],
  );

  return { dismissedAtIso: new Date(dismissed.rows[0].dismissed_at).toISOString() };
}

export async function listAnnouncements(includeArchived: boolean): Promise<Announcement[]> {
  const result = await queryDb<AnnouncementRow>(
    `
      SELECT
        id,
        title,
        body,
        status,
        schedule_at,
        published_at,
        expires_at,
        targeting,
        linked_plugin_slug,
        linked_plugin_slugs,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      FROM announcements
      WHERE ($1::boolean = TRUE OR status <> 'archived')
      ORDER BY created_at DESC
    `,
    [includeArchived],
  );

  return result.rows.map(mapAnnouncement);
}

// Validate a requested linked-plugin slug against the visible plugin registry. Returns the resolved
// { slug, name } only when the plugin exists, is visible to members, and is not admin-only (so a
// reader can actually open /apps/<slug>); otherwise null. Empty/whitespace/absent → null (no link).
async function resolveLinkedPlugin(slug: string | null | undefined): Promise<{ slug: string; name: string } | null> {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (trimmed.length === 0) {
    return null;
  }
  const plugin = await getPluginBySlug(trimmed);
  if (!plugin || !plugin.isVisible || isAdminOnlyPlugin(plugin.slug)) {
    return null;
  }
  return { slug: plugin.slug, name: plugin.name };
}

// Cap on how many plugins one announcement can link. More than a few chips is information overload
// for a reader (owner directive, 2026-07-18), so the picker, storage, and render all stop at three.
const ANNOUNCEMENT_MAX_LINKED_PLUGINS = 3;

// Read the stored linked-plugin slugs for an announcement row. The JSONB `linked_plugin_slugs`
// array is the source of truth; when it is empty (a row written before multi-link, not yet
// backfilled) fall back to the legacy single-link column so its link still renders.
function readLinkedPluginSlugs(raw: unknown, legacy: string | null): string[] {
  const slugs: string[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        slugs.push(entry.trim());
      }
    }
  }
  if (slugs.length === 0 && typeof legacy === 'string' && legacy.trim().length > 0) {
    slugs.push(legacy.trim());
  }
  return slugs;
}

// Validate admin-supplied linked-plugin slugs against the visible plugin registry: trim, dedupe,
// drop anything that is not a visible, non-admin plugin, keep the admin's order, and cap at
// ANNOUNCEMENT_MAX_LINKED_PLUGINS. An empty/absent/all-invalid input yields an empty array.
async function validateAnnouncementLinkedPluginSlugs(input: string[] | null | undefined): Promise<string[]> {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const validated: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') {
      continue;
    }
    const resolved = await resolveLinkedPlugin(raw);
    if (!resolved || seen.has(resolved.slug)) {
      continue;
    }
    seen.add(resolved.slug);
    validated.push(resolved.slug);
    if (validated.length >= ANNOUNCEMENT_MAX_LINKED_PLUGINS) {
      break;
    }
  }
  return validated;
}

// For a set of announcement ids, resolve each one's linked plugin (when it has one) to { slug, name }.
// The Hub read uses this to render a clickable "Open <Plugin>" chip on the announcement card, in
// addition to the plain "Open <Plugin>: <url>" line already in the body. Only visible, non-admin
// plugins resolve (same rule as the in-body link line); anything else is omitted. Keyed by
// announcement id so the caller can attach it to the matching feed item.
export async function resolveAnnouncementLinkedPlugins(
  announcementIds: string[],
): Promise<Map<string, Array<{ slug: string; name: string }>>> {
  const resolved = new Map<string, Array<{ slug: string; name: string }>>();
  const ids = Array.from(new Set(announcementIds.filter((id) => typeof id === 'string' && id.length > 0)));
  if (ids.length === 0) {
    return resolved;
  }
  const rows = await queryDb<{ id: string; linked_plugin_slug: string | null; linked_plugin_slugs: unknown }>(
    'SELECT id, linked_plugin_slug, linked_plugin_slugs FROM announcements WHERE id = ANY($1::uuid[])',
    [ids],
  );
  await Promise.all(
    rows.rows.map(async (row) => {
      const slugs = readLinkedPluginSlugs(row.linked_plugin_slugs, row.linked_plugin_slug);
      const plugins: Array<{ slug: string; name: string }> = [];
      for (const slug of slugs) {
        const plugin = await resolveLinkedPlugin(slug);
        if (plugin) {
          plugins.push(plugin);
        }
      }
      if (plugins.length > 0) {
        resolved.set(row.id, plugins);
      }
    }),
  );
  return resolved;
}

// Compose the feed item body for a published announcement: the author's body, plus — for each valid
// linked plugin — a trailing call-to-action line with the full app URL so a reader on any surface
// (mobile feed, Commons) can go straight to the referenced app. Recomposed from the clean body every
// publish, so re-publishing never stacks duplicate link lines.
async function composeAnnouncementFeedBody(body: string, linkedPluginSlugs: string[]): Promise<string> {
  const lines: string[] = [];
  for (const slug of linkedPluginSlugs) {
    const resolved = await resolveLinkedPlugin(slug);
    if (!resolved) {
      continue;
    }
    const url = `https://app.chargingthefuture.com${getPluginRoute(resolved.slug)}`;
    lines.push(`Open ${resolved.name}: ${url}`);
  }
  if (lines.length === 0) {
    return body;
  }
  return `${body}\n\n${lines.join('\n')}`;
}

export async function createAnnouncementDraft(actorId: string, input: AnnouncementDraftInput): Promise<Announcement> {
  return withDbTransaction(async (client) => {
    const title = normalizeText(input.title);
    const body = normalizeMultilineText(input.body);
    const scheduleAtIso = normalizeNullableText(input.scheduleAtIso);
    const expiresAtIso = normalizeNullableText(input.expiresAtIso);
    const targeting = normalizeTargeting(input.targeting);
    const linkedPluginSlugs = await validateAnnouncementLinkedPluginSlugs(input.linkedPluginSlugs);
    // Mirror the first link into the legacy single-link column so any back-compat reader stays coherent.
    const primaryLinkedPluginSlug = linkedPluginSlugs[0] ?? null;

    const insert = await client.query<AnnouncementRow>(
      `
        INSERT INTO announcements
          (title, body, status, schedule_at, expires_at, targeting, linked_plugin_slug, linked_plugin_slugs, created_by_user_id, updated_by_user_id)
        VALUES
          ($1, $2, 'draft', $3::timestamptz, $4::timestamptz, $5::jsonb, $7, $8::jsonb, $6, $6)
        RETURNING
          id, title, body, status, schedule_at, published_at, expires_at, targeting,
          linked_plugin_slug, linked_plugin_slugs, created_by_user_id, updated_by_user_id, created_at, updated_at
      `,
      [title, body, scheduleAtIso, expiresAtIso, JSON.stringify(targeting), actorId, primaryLinkedPluginSlug, JSON.stringify(linkedPluginSlugs)],
    );

    const announcement = mapAnnouncement(insert.rows[0]);
    await client.query(
      `
        INSERT INTO announcement_revisions
          (announcement_id, revision_number, title, body, targeting, created_by_user_id, updated_by_user_id, status, schedule_at, expires_at)
        VALUES
          ($1::uuid, 1, $2, $3, $4::jsonb, $5, $5, 'draft', $6::timestamptz, $7::timestamptz)
      `,
      [
        announcement.id,
        announcement.title,
        announcement.body,
        JSON.stringify(announcement.targeting),
        actorId,
        announcement.scheduleAtIso,
        announcement.expiresAtIso,
      ],
    );

    return announcement;
  });
}

export async function updateAnnouncementDraft(actorId: string, announcementId: string, input: AnnouncementDraftInput): Promise<Announcement> {
  return withDbTransaction(async (client) => {
    const existing = await client.query<AnnouncementRow>(
      `
        SELECT
          id,
          title,
          body,
          status,
          schedule_at,
          published_at,
          expires_at,
          targeting,
          linked_plugin_slug,
          linked_plugin_slugs,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        FROM announcements
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [announcementId],
    );

    if (existing.rows.length === 0) {
      throw new Error('announcement_not_found');
    }

    if (existing.rows[0].status !== 'draft') {
      throw new Error('announcement_not_draft');
    }

    const title = normalizeText(input.title);
    const body = normalizeMultilineText(input.body);
    const scheduleAtIso = normalizeNullableText(input.scheduleAtIso);
    const expiresAtIso = normalizeNullableText(input.expiresAtIso);
    const targeting = normalizeTargeting(input.targeting);
    // Only change the linked plugins when the caller supplies the field; an absent field keeps the
    // existing links. An explicit empty array clears them.
    const linkedPluginSlugs =
      input.linkedPluginSlugs === undefined
        ? readLinkedPluginSlugs(existing.rows[0].linked_plugin_slugs, existing.rows[0].linked_plugin_slug)
        : await validateAnnouncementLinkedPluginSlugs(input.linkedPluginSlugs);
    // Keep the legacy single-link column mirrored to the first link.
    const primaryLinkedPluginSlug = linkedPluginSlugs[0] ?? null;

    const update = await client.query<AnnouncementRow>(
      `
        UPDATE announcements
        SET
          title = $2,
          body = $3,
          schedule_at = $4::timestamptz,
          expires_at = $5::timestamptz,
          targeting = $6::jsonb,
          linked_plugin_slug = $8,
          linked_plugin_slugs = $9::jsonb,
          updated_by_user_id = $7,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING
          id, title, body, status, schedule_at, published_at, expires_at, targeting,
          linked_plugin_slug, linked_plugin_slugs, created_by_user_id, updated_by_user_id, created_at, updated_at
      `,
      [announcementId, title, body, scheduleAtIso, expiresAtIso, JSON.stringify(targeting), actorId, primaryLinkedPluginSlug, JSON.stringify(linkedPluginSlugs)],
    );

    const revision = await nextAnnouncementRevision(client, announcementId);
    const announcement = mapAnnouncement(update.rows[0]);
    await client.query(
      `
        INSERT INTO announcement_revisions
          (announcement_id, revision_number, title, body, targeting, created_by_user_id, updated_by_user_id, status, schedule_at, expires_at)
        VALUES
          ($1::uuid, $2, $3, $4, $5::jsonb, $6, $6, 'draft', $7::timestamptz, $8::timestamptz)
      `,
      [
        announcement.id,
        revision,
        announcement.title,
        announcement.body,
        JSON.stringify(announcement.targeting),
        actorId,
        announcement.scheduleAtIso,
        announcement.expiresAtIso,
      ],
    );

    return announcement;
  });
}

export async function publishAnnouncement(actorId: string, announcementId: string): Promise<Announcement> {
  return withDbTransaction(async (client) => {
    const update = await client.query<AnnouncementRow>(
      `
        UPDATE announcements
        SET
          status = 'published',
          published_at = COALESCE(schedule_at, NOW()),
          updated_by_user_id = $2,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING
          id, title, body, status, schedule_at, published_at, expires_at, targeting,
          linked_plugin_slug, linked_plugin_slugs, created_by_user_id, updated_by_user_id, created_at, updated_at
      `,
      [announcementId, actorId],
    );

    if (update.rows.length === 0) {
      throw new Error('announcement_not_found');
    }

    const announcement = mapAnnouncement(update.rows[0]);
    await client.query(
      `
        INSERT INTO announcement_delivery_events (announcement_id, event_type, payload, created_by_user_id)
        VALUES ($1::uuid, 'published', $2::jsonb, $3)
      `,
      [announcement.id, JSON.stringify({ status: announcement.status, publishedAt: announcement.publishedAtIso }), actorId],
    );

    await syncFeedItemForAnnouncement(client, actorId, announcement);
    return announcement;
  });
}

export async function archiveAnnouncement(actorId: string, announcementId: string): Promise<Announcement> {
  return withDbTransaction(async (client) => {
    const update = await client.query<AnnouncementRow>(
      `
        UPDATE announcements
        SET
          status = 'archived',
          updated_by_user_id = $2,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING
          id, title, body, status, schedule_at, published_at, expires_at, targeting,
          linked_plugin_slug, linked_plugin_slugs, created_by_user_id, updated_by_user_id, created_at, updated_at
      `,
      [announcementId, actorId],
    );

    if (update.rows.length === 0) {
      throw new Error('announcement_not_found');
    }

    const announcement = mapAnnouncement(update.rows[0]);
    await client.query(
      `
        INSERT INTO announcement_delivery_events (announcement_id, event_type, payload, created_by_user_id)
        VALUES ($1::uuid, 'archived', $2::jsonb, $3)
      `,
      [announcement.id, JSON.stringify({ status: announcement.status }), actorId],
    );

    await syncFeedItemForAnnouncement(client, actorId, announcement);
    return announcement;
  });
}

// Returns the stored read_at so the route can report the timestamp the database actually wrote,
// matching markFeedItemRead/dismissFeedItem, rather than a route-computed approximation.
export async function markAnnouncementRead(
  userId: string,
  announcementId: string,
): Promise<{ readAtIso: string }> {
  const result = await queryDb<{ read_at: string }>(
    `
      INSERT INTO announcement_user_state (user_id, announcement_id, read_at, acknowledged_at, updated_at)
      VALUES ($1, $2::uuid, NOW(), NOW(), NOW())
      ON CONFLICT (user_id, announcement_id)
      DO UPDATE SET read_at = NOW(), acknowledged_at = NOW(), updated_at = NOW()
      RETURNING read_at
    `,
    [userId, announcementId],
  );
  return { readAtIso: new Date(result.rows[0].read_at).toISOString() };
}

export async function dismissAnnouncement(
  userId: string,
  announcementId: string,
): Promise<{ dismissedAtIso: string }> {
  const result = await queryDb<{ id: string }>(
    'SELECT id FROM announcements WHERE id = $1::uuid LIMIT 1',
    [announcementId],
  );

  if (result.rows.length === 0) {
    throw new Error('announcement_not_found');
  }

  const dismissed = await queryDb<{ dismissed_at: string }>(
    `
      INSERT INTO announcement_user_state (user_id, announcement_id, dismissed_at, updated_at)
      VALUES ($1, $2::uuid, NOW(), NOW())
      ON CONFLICT (user_id, announcement_id)
      DO UPDATE SET dismissed_at = NOW(), updated_at = NOW()
      RETURNING dismissed_at
    `,
    [userId, announcementId],
  );

  return { dismissedAtIso: new Date(dismissed.rows[0].dismissed_at).toISOString() };
}

export function validateAnnouncementTargeting(targeting: unknown): { ok: boolean; normalized: AnnouncementTargeting } {
  const normalized = normalizeTargeting(targeting);
  const hasInvalidRole = (normalized.roles ?? []).some((role) => !['member', 'admin', 'all'].includes(role));

  if (hasInvalidRole) {
    return { ok: false, normalized };
  }

  return { ok: true, normalized };
}

export async function createFeedQuestion(actorId: string, input: FeedQuestionInput): Promise<{ questionId: string; createdAtIso: string }> {
  return withDbTransaction(async (client) => {
    const body = normalizeText(input.body);
    const category = inferFeedQuestionCategory(body, input.category);
    const location = normalizeLocationContext(input.location);

    if (!passesFeedModeration(body)) {
      throw new Error('content_policy_violation');
    }

    const allowed = await evaluateFeedRateLimit(client, {
      userId: actorId,
      tableName: 'feed_questions',
      limit: 5,
      windowMinutes: 60,
    });
    if (!allowed) {
      throw new Error('rate_limit_exceeded');
    }

    const inserted = await client.query<{ id: string; created_at: Date }>(
      `
        INSERT INTO feed_questions
          (asked_by_user_id, body, category, location_context, llm_consent_granted)
        VALUES
          ($1, $2, $3, $4::jsonb, $5)
        RETURNING id, created_at
      `,
      [actorId, body, category, JSON.stringify(location), input.consentGranted],
    );

    const questionId = inserted.rows[0].id;
    await syncFeedItemForQuestion(client, actorId, questionId, getQuestionTitle(category), body);

    return {
      questionId,
      createdAtIso: toIso(inserted.rows[0].created_at),
    };
  });
}

export async function generateFeedQuestionAnswer(actorId: string, questionId: string): Promise<FeedAnswer> {
  return withDbTransaction(async (client) => {
    const question = await client.query<FeedQuestionRow>(
      `
        SELECT id, asked_by_user_id, body, category, location_context, llm_consent_granted, created_at
        FROM feed_questions
        WHERE id = $1::uuid
          AND moderation_status = 'accepted'
        LIMIT 1
      `,
      [questionId],
    );

    if (question.rows.length === 0) {
      throw new Error('question_not_found');
    }

    const row = question.rows[0];
    if (!row.llm_consent_granted) {
      throw new Error('llm_consent_required');
    }

    const existing = await client.query<FeedAnswerRow>(
      `
        SELECT id, question_id, answer_type, body, confidence::text, model_id, sources, author_user_id, created_at
        FROM feed_answers
        WHERE question_id = $1::uuid AND answer_type = 'llm'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [questionId],
    );

    if (existing.rows.length > 0) {
      const mapped = mapAnswerRows(existing.rows, [], new Map()).get(questionId) ?? [];
      return mapped[0];
    }

    const draft = await generateFeedAssistedAnswer({
      questionBody: row.body,
      category: row.category,
      location: normalizeLocationContext(row.location_context),
    });

    const inserted = await client.query<FeedAnswerRow>(
      `
        INSERT INTO feed_answers
          (question_id, answer_type, body, confidence, model_id, sources, author_user_id)
        VALUES
          ($1::uuid, 'llm', $2, $3, $4, $5::jsonb, NULL)
        RETURNING id, question_id, answer_type, body, confidence::text, model_id, sources, author_user_id, created_at
      `,
      [questionId, draft.body, draft.confidence, draft.modelId, JSON.stringify(draft.sources)],
    );

    await client.query(
      `
        INSERT INTO llm_inference_log
          (actor_user_id, question_id, answer_id, model_id, request_payload, response_payload, sources, confidence, latency_ms, prompt_token_count, completion_token_count, total_token_count, status)
        VALUES
          ($1, $2::uuid, $3::uuid, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, 'completed')
      `,
      [
        actorId,
        questionId,
        inserted.rows[0].id,
        draft.modelId,
        JSON.stringify({ questionBody: row.body, category: row.category, location: normalizeLocationContext(row.location_context) }),
        JSON.stringify({ answerBody: draft.body }),
        JSON.stringify(draft.sources),
        draft.confidence,
        draft.latencyMs,
        draft.promptTokenCount,
        draft.completionTokenCount,
        draft.promptTokenCount + draft.completionTokenCount,
      ],
    );

    const mapped = mapAnswerRows(inserted.rows, [], new Map()).get(questionId) ?? [];
    return mapped[0];
  });
}

export async function rateFeedAnswer(
  actorId: string,
  answerId: string,
  rating: FeedAnswerRatingValue,
): Promise<{ answerId: string; ratedAtIso: string }> {
  return withDbTransaction(async (client) => {
    const answer = await client.query<{ id: string }>(
      'SELECT id FROM feed_answers WHERE id = $1::uuid LIMIT 1',
      [answerId],
    );

    if (answer.rows.length === 0) {
      throw new Error('answer_not_found');
    }

    const result = await client.query<{ updated_at: Date }>(
      `
        INSERT INTO feed_answer_ratings (user_id, answer_id, rating)
        VALUES ($1, $2::uuid, $3)
        ON CONFLICT (user_id, answer_id)
        DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
        RETURNING updated_at
      `,
      [actorId, answerId, rating],
    );

    return {
      answerId,
      ratedAtIso: toIso(result.rows[0].updated_at),
    };
  });
}

export async function createFeedCommunityPost(
  actorId: string,
  input: FeedCommunityPostInput,
  actorUsername: string | null = null,
  // Admins get a higher link cap so a detailed, link-rich welcome/help post from the owner is not
  // blocked as spam. Members keep the low cap. The `<>`-tag block still applies to everyone.
  isPrivileged: boolean = false,
): Promise<{ postId: string; createdAtIso: string }> {
  // When this post is a reply, the parent post's author (captured inside the transaction) is notified
  // after commit — best-effort, and never for a self-reply. The committed body is captured too so the
  // @-mentions it addresses can be notified after commit.
  let replyParentAuthorId: string | null = null;
  let committedBody = '';
  const result = await withDbTransaction(async (client) => {
    const body = normalizeMultilineText(input.body);
    committedBody = body;
    const category = normalizeCommunityCategory(input.category);

    const urlCap = isPrivileged ? FEED_ADMIN_MAX_COMMUNITY_POST_URLS : FEED_MAX_COMMUNITY_POST_URLS;
    if (!passesFeedModeration(body, urlCap)) {
      throw new Error('content_policy_violation');
    }

    // Signal-style reply: when a quoted post id is given it must be a valid UUID that
    // references an existing post. An unknown/malformed id is rejected rather than stored
    // as a dangling reference.
    const replyToPostId = normalizeUuid(input.replyToPostId);
    if (input.replyToPostId !== undefined && input.replyToPostId !== null && replyToPostId === null) {
      throw new Error('reply_target_invalid');
    }
    if (replyToPostId !== null) {
      const target = await client.query<{ id: string; author_user_id: string }>(
        'SELECT id, author_user_id FROM feed_community_posts WHERE id = $1::uuid LIMIT 1',
        [replyToPostId],
      );
      if (target.rows.length === 0) {
        throw new Error('reply_target_not_found');
      }
      replyParentAuthorId = target.rows[0].author_user_id;
    }

    const allowed = await evaluateFeedRateLimit(client, {
      userId: actorId,
      tableName: 'feed_community_posts',
      limit: 8,
      windowMinutes: 30,
    });
    if (!allowed) {
      throw new Error('rate_limit_exceeded');
    }

    const inserted = await client.query<{ id: string; created_at: Date }>(
      `
        INSERT INTO feed_community_posts (author_user_id, author_username, body, category, moderation_status, reply_to_post_id)
        VALUES ($1, $2, $3, $4, 'accepted', $5::uuid)
        RETURNING id, created_at
      `,
      [actorId, actorUsername, body, category, replyToPostId],
    );

    const postId = inserted.rows[0].id;
    await syncFeedItemForCommunityPost(client, actorId, postId, getCommunityTitle(category), body);

    // Every Nth post, publish the Commons guidance notice. Inside this transaction on purpose: the
    // count, the milestone claim, and the notice all commit with the post that triggered them, so a
    // rolled-back post can never leave a claimed milestone behind that silently suppresses the notice
    // forever. Best-effort in the sense that a failure is swallowed (below) — never in the sense of
    // running after commit, which would open exactly that gap.
    await maybePostCommonsGuidance(client);

    return {
      postId,
      createdAtIso: toIso(inserted.rows[0].created_at),
    };
  });

  // Notify the parent post's author that someone replied — after commit, best-effort, never for a
  // self-reply. Neutral summary (no author name or content) so it is safe wherever it surfaces.
  if (replyParentAuthorId && replyParentAuthorId !== actorId) {
    await notifySafe({
      userId: replyParentAuthorId,
      sourcePlugin: 'commons',
      notificationType: 'commons.reply',
      category: 'community',
      summary: 'Someone replied to your post in the Commons.',
      // Deep link to the reply itself so "Open" lands on the new message, not the top of the Commons.
      linkPath: `/?post=${encodeURIComponent(result.postId)}`,
      targetRef: result.postId,
    });
  }

  // Notify each member this post @-mentions — after commit, best-effort. Resolving a handle to a user
  // id (Clerk for usernames, our own post authors for the pseudonym) can miss, so it never blocks the
  // post. Skip the author (no self-mention) and skip the parent author when this is a reply (they
  // already got the reply notification above, so a reply that also @-mentions them is not doubled).
  await notifyMentionedMembers(committedBody, actorId, replyParentAuthorId, result.postId);

  return result;
}

// Resolve the @-mentions in a just-posted body and notify each addressed member. Best-effort and
// self-contained: any failure is swallowed so it can never break the post that triggered it. Deduped
// per post via target_ref, so a member mentioned twice in one post is notified once.
async function notifyMentionedMembers(
  body: string,
  actorId: string,
  replyParentAuthorId: string | null,
  postId: string,
): Promise<void> {
  try {
    const handles = extractMentionHandles(body);
    if (handles.length === 0) {
      return;
    }
    const mentionedIds = await resolveMentionUserIds(handles);
    for (const userId of mentionedIds) {
      if (userId === actorId || userId === replyParentAuthorId) {
        continue;
      }
      await notifySafe({
        userId,
        sourcePlugin: 'commons',
        notificationType: 'commons.mention',
        category: 'community',
        summary: 'Someone mentioned you in the Commons.',
        // Deep link to the post that mentions them so "Open" lands on that exact message.
        linkPath: `/?post=${encodeURIComponent(postId)}`,
        targetRef: postId,
      });
    }
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'emit_commons.mention' });
  }
}

// Delete a member's own community (peer) post from the Commons. Author-only: the caller must own
// the post, so this cannot delete anyone else's. A hard delete is intentional — the product allows
// "delete + repost" instead of editing, so a corrected post is a brand-new row with fresh
// moderation and no inherited reactions/replies (closes the bait-and-switch edit vector). Deleting
// the post cascades its replies and reactions (ON DELETE CASCADE); the projected `feed_items` row
// has no foreign key back to the post, so it is removed explicitly, which in turn cascades its
// targets, read state, and dismissals. Any other post that quoted this one keeps its reply
// (`reply_to_post_id` is ON DELETE SET NULL), so the quote block just resolves to nothing.
export async function deleteCommunityPost(actorId: string, postId: string): Promise<'ok'> {
  const normalizedPostId = normalizeUuid(postId);
  if (normalizedPostId === null) {
    throw new Error('post_not_found');
  }

  return withDbTransaction(async (client) => {
    const post = await client.query<{ author_user_id: string }>(
      'SELECT author_user_id FROM feed_community_posts WHERE id = $1::uuid LIMIT 1',
      [normalizedPostId],
    );

    if (post.rows.length === 0) {
      throw new Error('post_not_found');
    }
    if (post.rows[0].author_user_id !== actorId) {
      throw new Error('not_post_owner');
    }

    // Remove the projected timeline row first (no FK from feed_items to the post), then the post
    // itself (cascades replies + reactions). Both inside one transaction so the Commons never shows
    // a post whose source row is gone, or vice versa.
    await client.query('DELETE FROM feed_items WHERE source_community_post_id = $1::uuid', [normalizedPostId]);
    await client.query('DELETE FROM feed_community_posts WHERE id = $1::uuid', [normalizedPostId]);

    return 'ok' as const;
  });
}

export async function replyToFeedCommunityPost(
  actorId: string,
  postId: string,
  bodyInput: string,
): Promise<{ replyId: string; createdAtIso: string }> {
  return withDbTransaction(async (client) => {
    const body = normalizeMultilineText(bodyInput);
    if (!passesFeedModeration(body)) {
      throw new Error('content_policy_violation');
    }

    const post = await client.query<{ id: string }>(
      'SELECT id FROM feed_community_posts WHERE id = $1::uuid LIMIT 1',
      [postId],
    );
    if (post.rows.length === 0) {
      throw new Error('post_not_found');
    }

    const allowed = await evaluateFeedRateLimit(client, {
      userId: actorId,
      tableName: 'feed_community_replies',
      limit: 20,
      windowMinutes: 30,
    });
    if (!allowed) {
      throw new Error('rate_limit_exceeded');
    }

    const inserted = await client.query<{ id: string; created_at: Date }>(
      `
        INSERT INTO feed_community_replies (post_id, author_user_id, body, moderation_status)
        VALUES ($1::uuid, $2, $3, 'accepted')
        RETURNING id, created_at
      `,
      [postId, actorId, body],
    );

    await client.query(
      `
        UPDATE feed_community_posts
        SET reply_count = reply_count + 1, updated_at = NOW()
        WHERE id = $1::uuid
      `,
      [postId],
    );

    return {
      replyId: inserted.rows[0].id,
      createdAtIso: toIso(inserted.rows[0].created_at),
    };
  });
}

// Toggle a member's emoji reaction on a community post. The emoji must be in the fixed quick
// set and the post must exist. INSERT ... ON CONFLICT DO NOTHING adds the reaction; when the
// row already existed (nothing inserted) the existing one is removed instead — so a second tap
// of the same emoji clears it. Returns whether the post is now reacted with that emoji.
export async function toggleCommunityPostReaction(
  userId: string,
  postId: string,
  emoji: string,
): Promise<{ reacted: boolean }> {
  if (!isAllowedFeedReactionEmoji(emoji)) {
    throw new Error('reaction_emoji_invalid');
  }

  const normalizedPostId = normalizeUuid(postId);
  if (normalizedPostId === null) {
    throw new Error('post_not_found');
  }

  return withDbTransaction(async (client) => {
    const post = await client.query<{ author_user_id: string }>(
      'SELECT author_user_id FROM feed_community_posts WHERE id = $1::uuid LIMIT 1',
      [normalizedPostId],
    );
    if (post.rows.length === 0) {
      throw new Error('post_not_found');
    }
    // A member may only react to posts they did not author — reacting to your own post is not
    // allowed. This is the authoritative guard; the client also hides the affordance on own posts.
    if (post.rows[0].author_user_id === userId) {
      throw new Error('cannot_react_to_own_post');
    }

    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO feed_community_post_reactions (post_id, user_id, emoji)
        VALUES ($1::uuid, $2, $3)
        ON CONFLICT (post_id, user_id, emoji) DO NOTHING
        RETURNING id
      `,
      [normalizedPostId, userId, emoji],
    );

    if (inserted.rows.length > 0) {
      return { reacted: true };
    }

    // The reaction already existed: a second tap removes it (toggle off).
    await client.query(
      `
        DELETE FROM feed_community_post_reactions
        WHERE post_id = $1::uuid AND user_id = $2 AND emoji = $3
      `,
      [normalizedPostId, userId, emoji],
    );

    return { reacted: false };
  });
}

// Toggle a member's emoji reaction on an official announcement. Mirrors
// toggleCommunityPostReaction but keyed on the announcement: the emoji must be in the fixed quick
// set and the announcement must exist and be published. INSERT ... ON CONFLICT DO NOTHING adds the
// reaction; when the row already existed (nothing inserted) the existing one is removed instead —
// so a second tap of the same emoji clears it. Returns whether the announcement is now reacted
// with that emoji by this member.
export async function toggleAnnouncementReaction(
  userId: string,
  announcementId: string,
  emoji: string,
): Promise<{ reacted: boolean }> {
  if (!isAllowedFeedReactionEmoji(emoji)) {
    throw new Error('reaction_emoji_invalid');
  }

  const normalizedId = normalizeUuid(announcementId);
  if (normalizedId === null) {
    throw new Error('announcement_not_found');
  }

  return withDbTransaction(async (client) => {
    const announcement = await client.query<{ created_by_user_id: string }>(
      "SELECT created_by_user_id FROM announcements WHERE id = $1::uuid AND status = 'published' LIMIT 1",
      [normalizedId],
    );
    if (announcement.rows.length === 0) {
      throw new Error('announcement_not_found');
    }
    // Same rule as peer posts: you may not react to an announcement you authored. Members are never
    // the author of an official announcement, so this only guards the owner reacting to their own.
    if (announcement.rows[0].created_by_user_id === userId) {
      throw new Error('cannot_react_to_own_post');
    }

    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO announcement_reactions (announcement_id, user_id, emoji)
        VALUES ($1::uuid, $2, $3)
        ON CONFLICT (announcement_id, user_id, emoji) DO NOTHING
        RETURNING id
      `,
      [normalizedId, userId, emoji],
    );

    if (inserted.rows.length > 0) {
      return { reacted: true };
    }

    // The reaction already existed: a second tap removes it (toggle off).
    await client.query(
      `
        DELETE FROM announcement_reactions
        WHERE announcement_id = $1::uuid AND user_id = $2 AND emoji = $3
      `,
      [normalizedId, userId, emoji],
    );

    return { reacted: false };
  });
}

// Add a member's reply to an official announcement. Mirrors replyToFeedCommunityPost but keyed on
// the announcement: the announcement must exist and be published, the body passes the same
// moderation as a community post, and a per-member rate limit caps reply spam. author_username is
// captured so the thread can render the member's handle. Returns the created reply's id + time.
export async function replyToAnnouncement(
  actorId: string,
  announcementId: string,
  bodyInput: string,
  authorUsername: string | null,
): Promise<{ replyId: string; createdAtIso: string }> {
  const normalizedId = normalizeUuid(announcementId);
  if (normalizedId === null) {
    throw new Error('announcement_not_found');
  }

  // The announcement's author (captured inside the transaction) is notified after commit that a reply
  // landed — best-effort, and never when the author is the one replying.
  let announcementAuthorId: string | null = null;
  const result = await withDbTransaction(async (client) => {
    const body = normalizeMultilineText(bodyInput);
    if (!passesFeedModeration(body)) {
      throw new Error('content_policy_violation');
    }

    const announcement = await client.query<{ id: string; created_by_user_id: string }>(
      "SELECT id, created_by_user_id FROM announcements WHERE id = $1::uuid AND status = 'published' LIMIT 1",
      [normalizedId],
    );
    if (announcement.rows.length === 0) {
      throw new Error('announcement_not_found');
    }
    announcementAuthorId = announcement.rows[0].created_by_user_id;

    const allowed = await evaluateFeedRateLimit(client, {
      userId: actorId,
      tableName: 'announcement_replies',
      limit: 20,
      windowMinutes: 30,
    });
    if (!allowed) {
      throw new Error('rate_limit_exceeded');
    }

    const inserted = await client.query<{ id: string; created_at: Date }>(
      `
        INSERT INTO announcement_replies (announcement_id, author_user_id, author_username, body, moderation_status)
        VALUES ($1::uuid, $2, $3, $4, 'accepted')
        RETURNING id, created_at
      `,
      [normalizedId, actorId, normalizeNullableText(authorUsername), body],
    );

    return {
      replyId: inserted.rows[0].id,
      createdAtIso: toIso(inserted.rows[0].created_at),
    };
  });

  if (announcementAuthorId && announcementAuthorId !== actorId) {
    await notifySafe({
      userId: announcementAuthorId,
      sourcePlugin: 'commons',
      notificationType: 'commons.announcement_reply',
      category: 'community',
      summary: 'Someone replied to your announcement.',
      // Deep link to the announcement so "Open" lands on it (the reply thread opens from there),
      // rather than the top of the Commons.
      linkPath: `/?announcement=${encodeURIComponent(normalizedId)}`,
      targetRef: result.replyId,
    });
  }

  return result;
}

// List the accepted replies on an official announcement, oldest-first (thread order). Returns an
// empty array when the announcement has none. The announcement id is normalized so a malformed id
// simply yields no replies rather than throwing.
export async function listAnnouncementReplies(announcementId: string): Promise<FeedAnnouncementReply[]> {
  const normalizedId = normalizeUuid(announcementId);
  if (normalizedId === null) {
    return [];
  }

  const result = await queryDb<AnnouncementReplyRow>(
    `
      SELECT id, announcement_id, author_user_id, author_username, body, edited_at, created_at
      FROM announcement_replies
      WHERE announcement_id = $1::uuid
        AND moderation_status = 'accepted'
      ORDER BY created_at ASC
    `,
    [normalizedId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    announcementId: row.announcement_id,
    body: row.body,
    authorUserId: row.author_user_id,
    authorUsername: row.author_username,
    editedAtIso: row.edited_at ? toIso(row.edited_at) : null,
    createdAtIso: toIso(row.created_at),
  }));
}

// Rewrite the member's own reply on an announcement. Author-only: ownership is checked here rather
// than in the route so no caller can skip it. The new body passes the same moderation as a fresh
// reply — an edit must not be a way to post something the original body would have been blocked for.
// A reply a moderator has hidden cannot be edited back into view; that decision is the moderator's
// to reverse.
export async function editAnnouncementReply(
  actorId: string,
  replyId: string,
  bodyInput: string,
): Promise<{ body: string; editedAtIso: string }> {
  const normalizedId = normalizeUuid(replyId);
  if (normalizedId === null) {
    throw new Error('reply_not_found');
  }

  return withDbTransaction(async (client) => {
    const body = normalizeMultilineText(bodyInput);
    if (!passesFeedModeration(body)) {
      throw new Error('content_policy_violation');
    }

    const existing = await client.query<{ author_user_id: string; moderation_status: string }>(
      'SELECT author_user_id, moderation_status FROM announcement_replies WHERE id = $1::uuid FOR UPDATE',
      [normalizedId],
    );
    if (existing.rows.length === 0) {
      throw new Error('reply_not_found');
    }
    if (existing.rows[0].author_user_id !== actorId) {
      throw new Error('not_reply_owner');
    }
    if (existing.rows[0].moderation_status === FEED_MODERATION_STATUS.hidden) {
      throw new Error('reply_hidden');
    }

    const updated = await client.query<{ edited_at: Date }>(
      `
        UPDATE announcement_replies
        SET body = $2, edited_at = NOW(), updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING edited_at
      `,
      [normalizedId, body],
    );

    return { body, editedAtIso: toIso(updated.rows[0].edited_at) };
  });
}

// Delete the member's own reply on an announcement. Author-only, and a real delete rather than a
// hide: these are the member's own words and their own decision to take back. A moderator taking
// someone else's reply down uses the reversible hide instead (lib/feed/moderation).
export async function deleteAnnouncementReply(actorId: string, replyId: string): Promise<'ok'> {
  const normalizedId = normalizeUuid(replyId);
  if (normalizedId === null) {
    throw new Error('reply_not_found');
  }

  return withDbTransaction(async (client) => {
    const existing = await client.query<{ author_user_id: string }>(
      'SELECT author_user_id FROM announcement_replies WHERE id = $1::uuid FOR UPDATE',
      [normalizedId],
    );
    if (existing.rows.length === 0) {
      throw new Error('reply_not_found');
    }
    if (existing.rows[0].author_user_id !== actorId) {
      throw new Error('not_reply_owner');
    }

    await client.query('DELETE FROM announcement_replies WHERE id = $1::uuid', [normalizedId]);
    return 'ok' as const;
  });
}

// Read a member's last-seen marker for the Hub home channel. Returns null when the member
// has never been recorded (so the caller shows every message as new). Best-effort: callers
// must treat a thrown error as "no marker" and never let it break the chat.
export async function getCommonsLastSeen(userId: string): Promise<string | null> {
  const result = await queryDb<{ last_seen_at: Date }>(
    'SELECT last_seen_at FROM feed_commons_last_seen WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  return result.rows.length > 0 ? toIso(result.rows[0].last_seen_at) : null;
}

// Move a member's last-seen marker to now (or to the supplied time, capped at now). Used after
// the member views the Hub chat so the "New messages" divider reflects where they left off.
export async function updateCommonsLastSeen(userId: string, seenAtIso?: string | null): Promise<string> {
  const parsed = typeof seenAtIso === 'string' && isValidIsoDatetime(seenAtIso) ? new Date(seenAtIso) : null;
  // Never let a client push the marker into the future; clamp to server NOW().
  const useClientTime = parsed !== null && parsed.getTime() <= Date.now();
  const result = await queryDb<{ last_seen_at: Date }>(
    `
      INSERT INTO feed_commons_last_seen (user_id, last_seen_at)
      VALUES ($1, COALESCE($2::timestamptz, NOW()))
      ON CONFLICT (user_id)
      DO UPDATE SET last_seen_at = GREATEST(feed_commons_last_seen.last_seen_at, EXCLUDED.last_seen_at)
      RETURNING last_seen_at
    `,
    [userId, useClientTime && parsed ? parsed.toISOString() : null],
  );
  return toIso(result.rows[0].last_seen_at);
}

export async function emitMembershipEvent(input: {
  actorId: string;
  userId: string;
  pluginId: string;
  eventType: MembershipEventType;
  requestId: string | null;
  traceId: string | null;
}): Promise<{ streamEmitted: boolean }> {
  await withDbTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO feed_membership_events (actor_id, user_id, plugin_id, event_type, request_id, trace_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [input.actorId, input.userId, input.pluginId, input.eventType, input.requestId, input.traceId],
    );

    await client.query(
      `
        INSERT INTO announcement_membership_events (actor_id, user_id, plugin_id, event_type, request_id, trace_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [input.actorId, input.userId, input.pluginId, input.eventType, input.requestId, input.traceId],
    );

    await client.query(
      `
        INSERT INTO announcement_delivery_events (announcement_id, event_type, payload, created_by_user_id)
        SELECT id, 'membership_recalc', $1::jsonb, $2
        FROM announcements
        WHERE status = 'published'
      `,
      [JSON.stringify({ userId: input.userId, pluginId: input.pluginId, eventType: input.eventType }), input.actorId],
    );
  });

  const streamEmitted = await emitFeedMembershipEventToStream(input);
  return { streamEmitted };
}

export function isValidFeedChannel(value: string | null): value is FeedChannel {
  return value === 'all' || FEED_ALLOWED_CHANNELS.includes(value as FeedEnabledChannel);
}

export function isValidAnswerRating(value: string): value is FeedAnswerRatingValue {
  return FEED_ANSWER_RATINGS.includes(value as FeedAnswerRatingValue);
}

export function isValidFeedQuestionCategory(value: string): value is FeedQuestionCategory {
  return FEED_QUESTION_CATEGORIES.includes(value as FeedQuestionCategory);
}

type AdminFeedQuestionRow = {
  id: string;
  asked_by_user_id: string;
  body: string;
  category: FeedQuestionCategory;
  location_context: unknown;
  llm_consent_granted: boolean;
  created_at: Date;
  answer_count: string;
  helpful_count: string;
  not_helpful_count: string;
  flagged_count: string;
};

export type AdminFeedQuestion = {
  id: string;
  askedByUserId: string;
  body: string;
  category: FeedQuestionCategory;
  location: FeedLocationContext | null;
  llmConsentGranted: boolean;
  createdAtIso: string;
  answerCount: number;
  ratingSummary: { helpful: number; not_helpful: number; flagged: number };
};

function mapAdminQuestion(row: AdminFeedQuestionRow): AdminFeedQuestion {
  return {
    id: row.id,
    askedByUserId: row.asked_by_user_id,
    body: row.body,
    category: row.category,
    location: normalizeLocationContext(row.location_context),
    llmConsentGranted: row.llm_consent_granted,
    createdAtIso: toIso(row.created_at),
    answerCount: Number.parseInt(row.answer_count, 10),
    ratingSummary: {
      helpful: Number.parseInt(row.helpful_count, 10),
      not_helpful: Number.parseInt(row.not_helpful_count, 10),
      flagged: Number.parseInt(row.flagged_count, 10),
    },
  };
}

export async function listAdminQuestions(
  pagination: { page: number; pageSize: number },
  filters: { category?: FeedQuestionCategory | null },
): Promise<{ items: AdminFeedQuestion[]; pagination: FeedPagination }> {
  const offset = (pagination.page - 1) * pagination.pageSize;
  const categoryFilter = filters.category ?? null;

  const [countResult, rows] = await Promise.all([
    queryDb<CountRow>(
      `
        SELECT COUNT(DISTINCT fq.id)::text AS total
        FROM feed_questions fq
        WHERE ($1::text IS NULL OR fq.category = $1)
      `,
      [categoryFilter],
    ),
    queryDb<AdminFeedQuestionRow>(
      `
        SELECT
          fq.id,
          fq.asked_by_user_id,
          fq.body,
          fq.category,
          fq.location_context,
          fq.llm_consent_granted,
          fq.created_at,
          COUNT(DISTINCT fa.id)::text AS answer_count,
          COALESCE(SUM(CASE WHEN far.rating = 'helpful'     THEN 1 ELSE 0 END), 0)::text AS helpful_count,
          COALESCE(SUM(CASE WHEN far.rating = 'not_helpful' THEN 1 ELSE 0 END), 0)::text AS not_helpful_count,
          COALESCE(SUM(CASE WHEN far.rating = 'flagged'     THEN 1 ELSE 0 END), 0)::text AS flagged_count
        FROM feed_questions fq
        LEFT JOIN feed_answers fa ON fa.question_id = fq.id AND fa.answer_type = 'llm'
        LEFT JOIN feed_answer_ratings far ON far.answer_id = fa.id
        WHERE ($1::text IS NULL OR fq.category = $1)
        GROUP BY fq.id
        ORDER BY fq.created_at DESC
        OFFSET $2 LIMIT $3
      `,
      [categoryFilter, offset, pagination.pageSize],
    ),
  ]);

  return {
    items: rows.rows.map(mapAdminQuestion),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: Number.parseInt(countResult.rows[0]?.total ?? '0', 10),
    },
  };
}

export async function relabelQuestionCategory(
  actorId: string,
  questionId: string,
  category: FeedQuestionCategory,
): Promise<AdminFeedQuestion> {
  return withDbTransaction(async (client) => {
    const exists = await client.query<{ id: string }>(
      'SELECT id FROM feed_questions WHERE id = $1::uuid LIMIT 1',
      [questionId],
    );

    if (exists.rows.length === 0) {
      throw new Error('question_not_found');
    }

    await client.query(
      'UPDATE feed_questions SET category = $2 WHERE id = $1::uuid',
      [questionId, category],
    );

    await client.query(
      `UPDATE feed_items
         SET title = $2, updated_by_user_id = $3, updated_at = NOW()
         WHERE source_question_id = $1::uuid`,
      [questionId, getQuestionTitle(category), actorId],
    );

    const result = await client.query<AdminFeedQuestionRow>(
      `
        SELECT
          fq.id,
          fq.asked_by_user_id,
          fq.body,
          fq.category,
          fq.location_context,
          fq.llm_consent_granted,
          fq.created_at,
          COUNT(DISTINCT fa.id)::text AS answer_count,
          COALESCE(SUM(CASE WHEN far.rating = 'helpful'     THEN 1 ELSE 0 END), 0)::text AS helpful_count,
          COALESCE(SUM(CASE WHEN far.rating = 'not_helpful' THEN 1 ELSE 0 END), 0)::text AS not_helpful_count,
          COALESCE(SUM(CASE WHEN far.rating = 'flagged'     THEN 1 ELSE 0 END), 0)::text AS flagged_count
        FROM feed_questions fq
        LEFT JOIN feed_answers fa ON fa.question_id = fq.id AND fa.answer_type = 'llm'
        LEFT JOIN feed_answer_ratings far ON far.answer_id = fa.id
        WHERE fq.id = $1::uuid
        GROUP BY fq.id, fq.asked_by_user_id, fq.body, fq.category,
                 fq.location_context, fq.llm_consent_granted, fq.created_at
      `,
      [questionId],
    );

    await client.query(
      `
        INSERT INTO llm_inference_log
          (actor_user_id, question_id, answer_id, model_id, request_payload, response_payload, sources, confidence, latency_ms, prompt_token_count, completion_token_count, total_token_count, status)
        VALUES
          ($1, $2::uuid, NULL, 'admin-relabel', $3::jsonb, $4::jsonb, '[]'::jsonb, NULL, 0, 0, 0, 0, 'completed')
      `,
      [
        actorId,
        questionId,
        JSON.stringify({ action: 'relabel', newCategory: category }),
        JSON.stringify({ result: 'category_updated' }),
      ],
    );

    return mapAdminQuestion(result.rows[0]);
  });
}

type QuestionExportRow = {
  id: string;
  body: string;
  category: FeedQuestionCategory;
};

// Group every feed question by category. Used by the admin training export.
//
// Hidden questions are excluded. A moderator hiding something is a judgment that it does not belong in
// the Commons; exporting it into training data would launder it straight back in, and the model would
// keep answering in the register of the thing that was removed.
export async function exportQuestionsByCategory(): Promise<Record<FeedQuestionCategory, string[]>> {
  const result = await queryDb<QuestionExportRow>(
    `
      SELECT id, body, category
      FROM feed_questions
      WHERE moderation_status = 'accepted'
      ORDER BY category ASC, created_at ASC
    `,
  );

  const grouped: Record<FeedQuestionCategory, string[]> = {
    housing: [],
    services: [],
    general: [],
    safety: [],
    benefits: [],
  };

  for (const row of result.rows) {
    const cat = row.category as FeedQuestionCategory;
    if (cat in grouped) {
      grouped[cat].push(row.body.replace(/\n/g, ' ').trim());
    }
  }

  return grouped;
}
