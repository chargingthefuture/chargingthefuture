import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  FEED_ALLOWED_CHANNELS,
  FEED_ANSWER_RATINGS,
  FEED_COMMUNITY_CATEGORIES,
  FEED_DEFAULT_PAGE,
  FEED_DEFAULT_PAGE_SIZE,
  FEED_MAX_BODY_LENGTH,
  FEED_MAX_COMMUNITY_POST_LENGTH,
  FEED_MAX_COMMUNITY_REPLY_LENGTH,
  FEED_MAX_PAGE_SIZE,
  FEED_MAX_QUESTION_LENGTH,
  FEED_MAX_TITLE_LENGTH,
  FEED_QUESTION_CATEGORIES,
} from './constants';
import { generateFeedAssistedAnswer, inferFeedQuestionCategory } from './inference';
import { emitFeedMembershipEventToStream } from './stream';
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
  FeedQuotedPost,
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
  priority: number;
  mandatory: boolean;
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
  priority: number;
  mandatory: boolean;
  schedule_at: Date | null;
  published_at: Date | null;
  expires_at: Date | null;
  targeting: AnnouncementTargeting;
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

function quotedAuthorLabel(username: string | null): string {
  return username ? `@${username}` : 'Community member';
}

type FeedCommunityReplyRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  body: string;
  created_at: Date;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

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

function normalizeUuid(value: unknown): string | null {
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
    priority: row.priority,
    mandatory: row.mandatory,
    scheduleAtIso: row.schedule_at ? toIso(row.schedule_at) : null,
    publishedAtIso: row.published_at ? toIso(row.published_at) : null,
    expiresAtIso: row.expires_at ? toIso(row.expires_at) : null,
    targeting: normalizeTargeting(row.targeting),
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

function passesFeedModeration(text: string): boolean {
  if (text.length === 0) {
    return false;
  }

  if (/[<>]/.test(text)) {
    return false;
  }

  const urlCount = (text.match(/https?:\/\//g) ?? []).length;
  return urlCount <= 3;
}

async function evaluateFeedRateLimit(
  client: PoolClient,
  input: {
    userId: string;
    tableName: 'feed_questions' | 'feed_community_posts' | 'feed_community_replies';
    limit: number;
    windowMinutes: number;
  },
): Promise<boolean> {
  const actorColumn = input.tableName === 'feed_questions' ? 'asked_by_user_id' : 'author_user_id';
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

  const feedItemResult = await client.query<{ id: string }>(
    `
      INSERT INTO feed_items
        (item_type, source_announcement_id, title, body, priority, mandatory, published_at, expires_at, is_active, created_by_user_id, updated_by_user_id)
      VALUES
        ('announcement', $1::uuid, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7::timestamptz, TRUE, $8, $8)
      ON CONFLICT (source_announcement_id)
      DO UPDATE SET
        item_type = EXCLUDED.item_type,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        priority = EXCLUDED.priority,
        mandatory = EXCLUDED.mandatory,
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
      announcement.body,
      announcement.priority,
      announcement.mandatory,
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
        (item_type, source_question_id, title, body, priority, mandatory, published_at, is_active, created_by_user_id, updated_by_user_id)
      VALUES
        ('question', $1::uuid, $2, $3, 40, FALSE, NOW(), TRUE, $4, $4)
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
        (item_type, source_community_post_id, title, body, priority, mandatory, published_at, is_active, created_by_user_id, updated_by_user_id)
      VALUES
        ('community', $1::uuid, $2, $3, 20, FALSE, NOW(), TRUE, $4, $4)
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
  const body = normalizeText(input.body ?? '');
  const scheduleAt = normalizeNullableText(input.scheduleAtIso);
  const expiresAt = normalizeNullableText(input.expiresAtIso);

  const checks = [
    title.length > 0 && title.length <= FEED_MAX_TITLE_LENGTH,
    body.length > 0 && body.length <= FEED_MAX_BODY_LENGTH,
    input.priority === undefined || Number.isInteger(input.priority),
    input.mandatory === undefined || typeof input.mandatory === 'boolean',
    !scheduleAt || isValidIsoDatetime(scheduleAt),
    !expiresAt || isValidIsoDatetime(expiresAt),
  ];

  return checks.every(Boolean);
}

export function validateFeedQuestionInput(input: FeedQuestionInput): boolean {
  const body = normalizeText(input.body ?? '');
  return body.length > 0
    && body.length <= FEED_MAX_QUESTION_LENGTH
    && typeof input.consentGranted === 'boolean';
}

export function validateFeedCommunityPostInput(input: FeedCommunityPostInput): boolean {
  const body = normalizeText(input.body ?? '');
  const bodyOk = body.length > 0 && body.length <= FEED_MAX_COMMUNITY_POST_LENGTH;
  // replyToPostId is optional; when present it must be null or a well-formed UUID. The
  // referenced post's existence is checked inside the transaction in createFeedCommunityPost.
  const replyOk = input.replyToPostId === undefined
    || input.replyToPostId === null
    || normalizeUuid(input.replyToPostId) !== null;
  return bodyOk && replyOk;
}

export function validateFeedCommunityReplyBody(body: string): boolean {
  const normalized = normalizeText(body);
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

export async function listFeedTimeline(
  userId: string,
  role: string | null,
  pagination: { page: number; pageSize: number },
  filters: { pluginId?: string | null; channel?: FeedChannel },
): Promise<{ items: FeedTimelineItem[]; pagination: FeedPagination }> {
  return withDbTransaction(async (client) => {
    const config = await client.query<FeedConfigRow>(
      `
        SELECT render_mode, max_timeline_page_size, enabled_channels, is_public, updated_by_user_id, updated_at
        FROM feed_render_config
        WHERE singleton_key = TRUE
        LIMIT 1
      `,
    );

    const resolvedConfig = config.rows[0] ? mapFeedConfig(config.rows[0]) : null;

    const offset = (pagination.page - 1) * pagination.pageSize;
    const actorRole = role ?? 'member';
    const pluginFilter = normalizeNullableText(filters.pluginId);
    const enabledChannels = resolvedConfig?.enabledChannels ?? [...FEED_ALLOWED_CHANNELS];
    const requestedChannel = filters.channel ?? 'all';
    const allowedItemTypes = requestedChannel === 'all'
      ? enabledChannels
      : enabledChannels.filter((channel: string) => channel === requestedChannel);

    if (allowedItemTypes.length === 0) {
      return {
        items: [],
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: 0,
        },
      };
    }

    const count = await client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM feed_items f
        WHERE f.is_active = TRUE
          AND f.published_at <= NOW()
          AND (f.expires_at IS NULL OR f.expires_at > NOW())
          AND f.item_type = ANY($3::text[])
          AND EXISTS (
            SELECT 1
            FROM feed_item_targets t
            WHERE t.item_id = f.id
              AND t.target_role IN ($1, 'member', 'admin', 'all')
              AND ($2::text IS NULL OR t.target_plugin IS NULL OR t.target_plugin = $2)
          )
      `,
      [actorRole, pluginFilter, allowedItemTypes],
    );

    const total = Number.parseInt(count.rows[0]?.total ?? '0', 10);

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
          f.priority,
          f.mandatory,
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
          AND EXISTS (
            SELECT 1
            FROM feed_item_targets t
            WHERE t.item_id = f.id
              AND t.target_role IN ($1, 'member', 'admin', 'all')
              AND ($2::text IS NULL OR t.target_plugin IS NULL OR t.target_plugin = $2)
          )
        ORDER BY f.priority DESC, f.published_at DESC, f.id DESC
        OFFSET $5 LIMIT $6
      `,
      [actorRole, pluginFilter, allowedItemTypes, userId, offset, pagination.pageSize],
    );

    const questionIds = result.rows.flatMap((row) => (row.source_question_id ? [row.source_question_id] : []));
    const communityIds = result.rows.flatMap((row) => (row.source_community_post_id ? [row.source_community_post_id] : []));

    const questionDetails = new Map<string, FeedQuestionDetail>();
    if (questionIds.length > 0) {
      const [questionRows, answerRows, ratingRows, currentUserRatings] = await Promise.all([
        client.query<FeedQuestionRow>(
          `
            SELECT id, asked_by_user_id, body, category, location_context, llm_consent_granted, created_at
            FROM feed_questions
            WHERE id = ANY($1::uuid[])
          `,
          [questionIds],
        ),
        client.query<FeedAnswerRow>(
          `
            SELECT id, question_id, answer_type, body, confidence::text, model_id, sources, author_user_id, created_at
            FROM feed_answers
            WHERE question_id = ANY($1::uuid[])
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
    }

    const communityDetails = new Map<string, FeedCommunityDetail>();
    if (communityIds.length > 0) {
      const [postRows, replyRows] = await Promise.all([
        client.query<FeedCommunityPostRow>(
          `
            SELECT id, author_user_id, author_username, body, category, reply_count, reply_to_post_id, created_at
            FROM feed_community_posts
            WHERE id = ANY($1::uuid[])
          `,
          [communityIds],
        ),
        client.query<FeedCommunityReplyRow>(
          `
            SELECT id, post_id, author_user_id, body, created_at
            FROM feed_community_replies
            WHERE post_id = ANY($1::uuid[])
            ORDER BY created_at ASC
          `,
          [communityIds],
        ),
      ]);

      const repliesByPost = new Map<string, FeedCommunityReply[]>();
      for (const row of replyRows.rows) {
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

      // Resolve each quoted (replied-to) post's author handle and a short snippet of its
      // body. The quoted post may sit outside this timeline page, so look up the referenced
      // ids directly. Build a map id → { author, snippet } once.
      const quotedIds = Array.from(
        new Set(postRows.rows.flatMap((row) => (row.reply_to_post_id ? [row.reply_to_post_id] : []))),
      );
      const quotedById = new Map<string, FeedQuotedPost>();
      if (quotedIds.length > 0) {
        const quotedRows = await client.query<{
          id: string;
          author_username: string | null;
          body: string;
        }>(
          `
            SELECT id, author_username, body
            FROM feed_community_posts
            WHERE id = ANY($1::uuid[])
          `,
          [quotedIds],
        );
        for (const row of quotedRows.rows) {
          quotedById.set(row.id, {
            author: quotedAuthorLabel(row.author_username),
            snippet: buildQuoteSnippet(row.body),
          });
        }
      }

      for (const row of postRows.rows) {
        const quotedPost = row.reply_to_post_id ? quotedById.get(row.reply_to_post_id) ?? null : null;
        communityDetails.set(row.id, {
          id: row.id,
          body: row.body,
          category: row.category,
          authorUserId: row.author_user_id,
          authorUsername: row.author_username,
          replyCount: row.reply_count,
          replies: repliesByPost.get(row.id) ?? [],
          // The foreign key is ON DELETE SET NULL: if the quoted post was deleted, the
          // reference resolves to null and no quote block is rendered.
          replyToPostId: quotedPost ? row.reply_to_post_id : null,
          quotedPost,
        });
      }
    }

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        itemType: row.item_type,
        sourceAnnouncementId: row.source_announcement_id,
        sourceQuestionId: row.source_question_id,
        sourceCommunityPostId: row.source_community_post_id,
        title: row.title,
        body: row.body,
        priority: row.priority,
        mandatory: row.mandatory,
        publishedAtIso: toIso(row.published_at),
        expiresAtIso: row.expires_at ? toIso(row.expires_at) : null,
        isRead: row.is_read,
        isDismissed: row.is_dismissed,
        question: row.source_question_id ? (questionDetails.get(row.source_question_id) ?? null) : null,
        community: row.source_community_post_id ? (communityDetails.get(row.source_community_post_id) ?? null) : null,
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      },
    };
  });
}

export async function markFeedItemRead(userId: string, itemId: string): Promise<void> {
  await queryDb(
    `
      INSERT INTO feed_user_read_state (user_id, item_id, read_at)
      VALUES ($1, $2::uuid, NOW())
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
    `,
    [userId, itemId],
  );
}

export async function dismissFeedItem(userId: string, itemId: string): Promise<'ok' | 'mandatory'> {
  const result = await queryDb<{ mandatory: boolean }>(
    'SELECT mandatory FROM feed_items WHERE id = $1::uuid LIMIT 1',
    [itemId],
  );

  if (result.rows.length === 0) {
    throw new Error('feed_item_not_found');
  }

  if (result.rows[0].mandatory) {
    return 'mandatory';
  }

  await queryDb(
    `
      INSERT INTO feed_user_dismissals (user_id, item_id, dismissed_at)
      VALUES ($1, $2::uuid, NOW())
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at
    `,
    [userId, itemId],
  );

  return 'ok';
}

export async function listAnnouncements(includeArchived: boolean): Promise<Announcement[]> {
  const result = await queryDb<AnnouncementRow>(
    `
      SELECT
        id,
        title,
        body,
        status,
        priority,
        mandatory,
        schedule_at,
        published_at,
        expires_at,
        targeting,
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

export async function createAnnouncementDraft(actorId: string, input: AnnouncementDraftInput): Promise<Announcement> {
  return withDbTransaction(async (client) => {
    const title = normalizeText(input.title);
    const body = normalizeText(input.body);
    const priority = Number.isInteger(input.priority) ? Number(input.priority) : 0;
    const mandatory = Boolean(input.mandatory);
    const scheduleAtIso = normalizeNullableText(input.scheduleAtIso);
    const expiresAtIso = normalizeNullableText(input.expiresAtIso);
    const targeting = normalizeTargeting(input.targeting);

    const insert = await client.query<AnnouncementRow>(
      `
        INSERT INTO announcements
          (title, body, status, priority, mandatory, schedule_at, expires_at, targeting, created_by_user_id, updated_by_user_id)
        VALUES
          ($1, $2, 'draft', $3, $4, $5::timestamptz, $6::timestamptz, $7::jsonb, $8, $8)
        RETURNING
          id, title, body, status, priority, mandatory, schedule_at, published_at, expires_at, targeting,
          created_by_user_id, updated_by_user_id, created_at, updated_at
      `,
      [title, body, priority, mandatory, scheduleAtIso, expiresAtIso, JSON.stringify(targeting), actorId],
    );

    const announcement = mapAnnouncement(insert.rows[0]);
    await client.query(
      `
        INSERT INTO announcement_revisions
          (announcement_id, revision_number, title, body, targeting, created_by_user_id, updated_by_user_id, status, priority, mandatory, schedule_at, expires_at)
        VALUES
          ($1::uuid, 1, $2, $3, $4::jsonb, $5, $5, 'draft', $6, $7, $8::timestamptz, $9::timestamptz)
      `,
      [
        announcement.id,
        announcement.title,
        announcement.body,
        JSON.stringify(announcement.targeting),
        actorId,
        announcement.priority,
        announcement.mandatory,
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
          priority,
          mandatory,
          schedule_at,
          published_at,
          expires_at,
          targeting,
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
    const body = normalizeText(input.body);
    const priority = Number.isInteger(input.priority) ? Number(input.priority) : existing.rows[0].priority;
    const mandatory = typeof input.mandatory === 'boolean' ? input.mandatory : existing.rows[0].mandatory;
    const scheduleAtIso = normalizeNullableText(input.scheduleAtIso);
    const expiresAtIso = normalizeNullableText(input.expiresAtIso);
    const targeting = normalizeTargeting(input.targeting);

    const update = await client.query<AnnouncementRow>(
      `
        UPDATE announcements
        SET
          title = $2,
          body = $3,
          priority = $4,
          mandatory = $5,
          schedule_at = $6::timestamptz,
          expires_at = $7::timestamptz,
          targeting = $8::jsonb,
          updated_by_user_id = $9,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING
          id, title, body, status, priority, mandatory, schedule_at, published_at, expires_at, targeting,
          created_by_user_id, updated_by_user_id, created_at, updated_at
      `,
      [announcementId, title, body, priority, mandatory, scheduleAtIso, expiresAtIso, JSON.stringify(targeting), actorId],
    );

    const revision = await nextAnnouncementRevision(client, announcementId);
    const announcement = mapAnnouncement(update.rows[0]);
    await client.query(
      `
        INSERT INTO announcement_revisions
          (announcement_id, revision_number, title, body, targeting, created_by_user_id, updated_by_user_id, status, priority, mandatory, schedule_at, expires_at)
        VALUES
          ($1::uuid, $2, $3, $4, $5::jsonb, $6, $6, 'draft', $7, $8, $9::timestamptz, $10::timestamptz)
      `,
      [
        announcement.id,
        revision,
        announcement.title,
        announcement.body,
        JSON.stringify(announcement.targeting),
        actorId,
        announcement.priority,
        announcement.mandatory,
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
          id, title, body, status, priority, mandatory, schedule_at, published_at, expires_at, targeting,
          created_by_user_id, updated_by_user_id, created_at, updated_at
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
          id, title, body, status, priority, mandatory, schedule_at, published_at, expires_at, targeting,
          created_by_user_id, updated_by_user_id, created_at, updated_at
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

export async function markAnnouncementRead(userId: string, announcementId: string): Promise<void> {
  await queryDb(
    `
      INSERT INTO announcement_user_state (user_id, announcement_id, read_at, acknowledged_at, updated_at)
      VALUES ($1, $2::uuid, NOW(), NOW(), NOW())
      ON CONFLICT (user_id, announcement_id)
      DO UPDATE SET read_at = NOW(), acknowledged_at = NOW(), updated_at = NOW()
    `,
    [userId, announcementId],
  );
}

export async function dismissAnnouncement(userId: string, announcementId: string): Promise<'ok' | 'mandatory'> {
  const result = await queryDb<{ mandatory: boolean }>(
    'SELECT mandatory FROM announcements WHERE id = $1::uuid LIMIT 1',
    [announcementId],
  );

  if (result.rows.length === 0) {
    throw new Error('announcement_not_found');
  }

  if (result.rows[0].mandatory) {
    return 'mandatory';
  }

  await queryDb(
    `
      INSERT INTO announcement_user_state (user_id, announcement_id, dismissed_at, updated_at)
      VALUES ($1, $2::uuid, NOW(), NOW())
      ON CONFLICT (user_id, announcement_id)
      DO UPDATE SET dismissed_at = NOW(), updated_at = NOW()
    `,
    [userId, announcementId],
  );

  return 'ok';
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
): Promise<{ postId: string; createdAtIso: string }> {
  return withDbTransaction(async (client) => {
    const body = normalizeText(input.body);
    const category = normalizeCommunityCategory(input.category);

    if (!passesFeedModeration(body)) {
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
      const target = await client.query<{ id: string }>(
        'SELECT id FROM feed_community_posts WHERE id = $1::uuid LIMIT 1',
        [replyToPostId],
      );
      if (target.rows.length === 0) {
        throw new Error('reply_target_not_found');
      }
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

    return {
      postId,
      createdAtIso: toIso(inserted.rows[0].created_at),
    };
  });
}

export async function replyToFeedCommunityPost(
  actorId: string,
  postId: string,
  bodyInput: string,
): Promise<{ replyId: string; createdAtIso: string }> {
  return withDbTransaction(async (client) => {
    const body = normalizeText(bodyInput);
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

// Read a member's last-seen marker for the Hub home channel. Returns null when the member
// has never been recorded (so the caller shows every message as new). Best-effort: callers
// must treat a thrown error as "no marker" and never let it break the chat.
export async function getHubLastSeen(userId: string): Promise<string | null> {
  const result = await queryDb<{ last_seen_at: Date }>(
    'SELECT last_seen_at FROM feed_hub_last_seen WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  return result.rows.length > 0 ? toIso(result.rows[0].last_seen_at) : null;
}

// Move a member's last-seen marker to now (or to the supplied time, capped at now). Used after
// the member views the Hub chat so the "New messages" divider reflects where they left off.
export async function updateHubLastSeen(userId: string, seenAtIso?: string | null): Promise<string> {
  const parsed = typeof seenAtIso === 'string' && isValidIsoDatetime(seenAtIso) ? new Date(seenAtIso) : null;
  // Never let a client push the marker into the future; clamp to server NOW().
  const useClientTime = parsed !== null && parsed.getTime() <= Date.now();
  const result = await queryDb<{ last_seen_at: Date }>(
    `
      INSERT INTO feed_hub_last_seen (user_id, last_seen_at)
      VALUES ($1, COALESCE($2::timestamptz, NOW()))
      ON CONFLICT (user_id)
      DO UPDATE SET last_seen_at = GREATEST(feed_hub_last_seen.last_seen_at, EXCLUDED.last_seen_at)
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
export async function exportQuestionsByCategory(): Promise<Record<FeedQuestionCategory, string[]>> {
  const result = await queryDb<QuestionExportRow>(
    `
      SELECT id, body, category
      FROM feed_questions
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
