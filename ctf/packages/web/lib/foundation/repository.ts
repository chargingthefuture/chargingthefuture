import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  FOUNDATION_DEFAULT_PAGE,
  FOUNDATION_DEFAULT_PAGE_SIZE,
  FOUNDATION_MAX_PAGE_SIZE,
  FOUNDATION_QUOTE_STATES,
} from './constants';
import type {
  FoundationCallModality,
  FoundationCallSession,
  FoundationCapacityPolicy,
  FoundationMessage,
  FoundationNotificationEvent,
  FoundationProviderSearchItem,
  FoundationQuoteRequest,
  FoundationQuoteState,
  FoundationThread,
} from './types';
import { clearMemberPresence, recordMemberPresence } from 'lib/presence/live';

// Cross-plugin presence: a Foundation provider offering (one offered skill) marks the provider as
// active in Foundation. One presence row is kept per offered skill, using the skill id as the ref id.
const FOUNDATION_PRESENCE_SLUG = 'foundation';
const FOUNDATION_PRESENCE_REF_TYPE = 'provider-skill';
const FOUNDATION_PRESENCE_LABEL = 'Provider offering';
const FOUNDATION_PRESENCE_DEEP_LINK = '/apps/foundation';
import {
  createFoundationCallToken,
  createFoundationParticipantToken,
  ensureFoundationStreamChannel,
  sendFoundationStreamMessage,
} from './stream';

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function parseCountRow(rows: Array<{ total: string }>): number {
  return Number.parseInt(rows[0]?.total ?? '0', 10);
}

function normalizePage(inputPage: number | undefined, inputPageSize: number | undefined): { page: number; pageSize: number; offset: number } {
  const page = Number.isInteger(inputPage) && Number(inputPage) > 0 ? Number(inputPage) : FOUNDATION_DEFAULT_PAGE;
  const pageSize = Number.isInteger(inputPageSize)
    ? Math.min(FOUNDATION_MAX_PAGE_SIZE, Math.max(1, Number(inputPageSize)))
    : FOUNDATION_DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseJsonArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
}

type FoundationProviderRow = {
  profile_id: string;
  provider_user_id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  // Member location read straight from the claimed directory profile (the shared member profile),
  // not a Foundation-owned copy.
  city: string | null;
  state: string | null;
  country: string | null;
  score: number;
  offered_skills: { id: string; name: string }[] | null;
  instant_call_enabled: boolean | null;
  instant_call_rate_credits: number | null;
  instant_call_interval_minutes: number | null;
  short_description: string | null;
};

function mapProviderRow(row: FoundationProviderRow): FoundationProviderSearchItem {
  // The instant-call fields are a read-only mirror of the provider's own settings (Foundation
  // "Connect now", issue #808). A provider with no foundation_user_extension row reads the off
  // default. The rate is only meaningful when enabled; the call lifecycle is a later task of #808.
  const rate = row.instant_call_rate_credits;
  return {
    profileId: row.profile_id,
    providerUserId: row.provider_user_id,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
    city: row.city,
    state: row.state,
    country: row.country,
    score: Number(row.score),
    offeredSkills: Array.isArray(row.offered_skills) ? row.offered_skills : [],
    instantCallEnabled: Boolean(row.instant_call_enabled),
    instantCallRateCredits: rate === null || rate === undefined ? null : Number(rate),
    instantCallIntervalMinutes: Number(row.instant_call_interval_minutes ?? FOUNDATION_INSTANT_CALL_DEFAULT_INTERVAL),
    shortDescription: row.short_description && row.short_description.trim().length > 0 ? row.short_description : null,
  };
}

export async function searchProviders(input: {
  query: string;
  skillId?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<{ items: FoundationProviderSearchItem[]; total: number; pagination: { page: number; pageSize: number } }> {
  const paging = normalizePage(input.page, input.pageSize);
  const searchValue = input.query.trim();

  const searchPattern = searchValue.length > 0 ? `%${searchValue}%` : '%';
  const skillId = input.skillId && input.skillId.trim().length > 0 ? input.skillId.trim() : null;

  // A Foundation provider is a claimed directory profile that has opted in to offer at least one
  // skill (a row in foundation_provider_skills). When a skill is given, restrict to providers who
  // offer that exact skill. Unlike the Directory (which lists skills), this only surfaces people who
  // chose to be contacted — so a survivor is not reaching out into the void.
  const [countResult, itemsResult] = await Promise.all([
    queryDb<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM directory_profiles dp
        WHERE dp.is_active = TRUE
          AND dp.claimed_by_user_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM foundation_provider_skills fps WHERE fps.user_id = dp.claimed_by_user_id)
          AND ($2::uuid IS NULL OR EXISTS (
            SELECT 1 FROM foundation_provider_skills fps2
            WHERE fps2.user_id = dp.claimed_by_user_id AND fps2.skill_id = $2::uuid
          ))
          AND (
            $1::text = '%'
            OR TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.last_name, '')) ILIKE $1
            OR COALESCE(dp.headline, '') ILIKE $1
            OR COALESCE(dp.bio, '') ILIKE $1
          )
      `,
      [searchPattern, skillId],
    ),
    queryDb<FoundationProviderRow>(
      `
        SELECT
          dp.id::text AS profile_id,
          dp.claimed_by_user_id AS provider_user_id,
          TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.last_name, '')) AS display_name,
          dp.headline,
          dp.bio,
          dp.city,
          dp.state,
          dp.country,
          (
            CASE WHEN TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.last_name, '')) ILIKE $1 THEN 6 ELSE 0 END +
            CASE WHEN COALESCE(dp.headline, '') ILIKE $1 THEN 3 ELSE 0 END +
            CASE WHEN COALESCE(dp.bio, '') ILIKE $1 THEN 2 ELSE 0 END
          ) AS score,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', s.id::text, 'name', s.name) ORDER BY s.name)
            FROM foundation_provider_skills fps
            JOIN skills_taxonomy_skills s ON s.id = fps.skill_id
            WHERE fps.user_id = dp.claimed_by_user_id
          ), '[]'::jsonb) AS offered_skills,
          fue.instant_call_enabled,
          fue.instant_call_rate_credits,
          fue.instant_call_interval_minutes,
          fue.short_description
        FROM directory_profiles dp
        LEFT JOIN foundation_user_extension fue ON fue.user_id = dp.claimed_by_user_id
        WHERE dp.is_active = TRUE
          AND dp.claimed_by_user_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM foundation_provider_skills fps WHERE fps.user_id = dp.claimed_by_user_id)
          AND ($4::uuid IS NULL OR EXISTS (
            SELECT 1 FROM foundation_provider_skills fps2
            WHERE fps2.user_id = dp.claimed_by_user_id AND fps2.skill_id = $4::uuid
          ))
          AND (
            $1::text = '%'
            OR TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.last_name, '')) ILIKE $1
            OR COALESCE(dp.headline, '') ILIKE $1
            OR COALESCE(dp.bio, '') ILIKE $1
          )
        ORDER BY score DESC, dp.updated_at DESC
        LIMIT $2 OFFSET $3
      `,
      [searchPattern, paging.pageSize, paging.offset, skillId],
    ),
  ]);

  return {
    items: itemsResult.rows.map(mapProviderRow),
    total: Number.parseInt(countResult.rows[0]?.total ?? '0', 10),
    pagination: {
      page: paging.page,
      pageSize: paging.pageSize,
    },
  };
}

// Fetch one Foundation provider by directory-profile id. A provider is the same thing search
// returns: a claimed, active directory profile that has opted in to offer at least one skill. Backs
// the auth-gated deep-link page (/apps/foundation/provider/[id]) so a shared link opens that
// provider for a signed-in member. Returns null when the id matches no active provider (e.g. the
// profile was deactivated, unclaimed, or has stopped offering any skill). Behind the same read
// gate as search — never exposed to unauthenticated visitors.
export async function getProviderById(profileId: string): Promise<FoundationProviderSearchItem | null> {
  const id = typeof profileId === 'string' ? profileId.trim() : '';
  if (id.length === 0) return null;

  const result = await queryDb<FoundationProviderRow>(
    `
      SELECT
        dp.id::text AS profile_id,
        dp.claimed_by_user_id AS provider_user_id,
        TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.last_name, '')) AS display_name,
        dp.headline,
        dp.bio,
        dp.city,
        dp.state,
        dp.country,
        0 AS score,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', s.id::text, 'name', s.name) ORDER BY s.name)
          FROM foundation_provider_skills fps
          JOIN skills_taxonomy_skills s ON s.id = fps.skill_id
          WHERE fps.user_id = dp.claimed_by_user_id
        ), '[]'::jsonb) AS offered_skills,
        fue.instant_call_enabled,
        fue.instant_call_rate_credits,
        fue.instant_call_interval_minutes,
        fue.short_description
      FROM directory_profiles dp
      LEFT JOIN foundation_user_extension fue ON fue.user_id = dp.claimed_by_user_id
      WHERE dp.id::text = $1
        AND dp.is_active = TRUE
        AND dp.claimed_by_user_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM foundation_provider_skills fps WHERE fps.user_id = dp.claimed_by_user_id)
      LIMIT 1
    `,
    [id],
  );

  const row = result.rows[0];
  return row ? mapProviderRow(row) : null;
}

// The skills a member could offer through Foundation: the skills on their own claimed Directory
// profile, each marked whether they have currently opted in to be contacted about it. The picker
// uses this so a provider can only offer skills they actually list in the Directory.
export async function listOwnOfferableSkills(
  userId: string,
): Promise<Array<{ id: string; name: string; offered: boolean }>> {
  const result = await queryDb<{ id: string; name: string; offered: boolean }>(
    `
      SELECT s.id::text AS id, s.name AS name,
             (fps.user_id IS NOT NULL) AS offered
      FROM directory_profiles dp
      JOIN directory_profile_skills dps ON dps.profile_id::text = dp.id::text
      JOIN skills_taxonomy_skills s ON s.id = dps.skill_id
      LEFT JOIN foundation_provider_skills fps
        ON fps.user_id = dp.claimed_by_user_id AND fps.skill_id = s.id
      WHERE dp.claimed_by_user_id = $1 AND dp.is_active = TRUE AND dp.deleted_at IS NULL
      ORDER BY s.name ASC
    `,
    [userId],
  );

  return result.rows.map((row) => ({ id: row.id, name: row.name, offered: row.offered }));
}

// Replace the member's set of offered skills. Only skills they actually list on their own claimed,
// active Directory profile are accepted — anything else is silently dropped, so a member can never
// advertise a Foundation offer for a skill they do not list in the Directory (the source of truth).
export async function setOwnOfferedSkills(userId: string, skillIds: string[]): Promise<string[]> {
  const unique = Array.from(new Set(skillIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));

  const { accepted, previous } = await withDbTransaction(async (client) => {
    const eligible = await client.query<{ id: string }>(
      `
        SELECT s.id::text AS id
        FROM directory_profiles dp
        JOIN directory_profile_skills dps ON dps.profile_id::text = dp.id::text
        JOIN skills_taxonomy_skills s ON s.id = dps.skill_id
        WHERE dp.claimed_by_user_id = $1 AND dp.is_active = TRUE AND dp.deleted_at IS NULL
      `,
      [userId],
    );
    const eligibleIds = new Set(eligible.rows.map((row) => row.id));
    const acceptedIds = unique.filter((id) => eligibleIds.has(id));

    // Capture the previously offered skill ids so presence rows for skills dropped from the set can be
    // deactivated after commit.
    const before = await client.query<{ skill_id: string }>(
      `SELECT skill_id::text AS skill_id FROM foundation_provider_skills WHERE user_id = $1`,
      [userId],
    );
    const previousIds = before.rows.map((row) => row.skill_id);

    await client.query('DELETE FROM foundation_provider_skills WHERE user_id = $1', [userId]);
    for (const skillId of acceptedIds) {
      await client.query(
        `INSERT INTO foundation_provider_skills (user_id, skill_id) VALUES ($1, $2::uuid)
         ON CONFLICT (user_id, skill_id) DO NOTHING`,
        [userId, skillId],
      );
    }

    return { accepted: acceptedIds, previous: previousIds };
  });

  // Best-effort presence sync after the offered-skill set is durably replaced. One presence row per
  // offered skill (ref id = skill id, mirroring the backfill). Record each currently offered skill and
  // clear any skill that was offered before but is no longer in the set. Never breaks the save.
  const acceptedSet = new Set(accepted);
  for (const skillId of accepted) {
    await recordMemberPresence({
      userId,
      pluginSlug: FOUNDATION_PRESENCE_SLUG,
      refType: FOUNDATION_PRESENCE_REF_TYPE,
      refId: skillId,
      label: FOUNDATION_PRESENCE_LABEL,
      deepLink: FOUNDATION_PRESENCE_DEEP_LINK,
    });
  }
  for (const skillId of previous) {
    if (!acceptedSet.has(skillId)) {
      await clearMemberPresence({
        userId,
        pluginSlug: FOUNDATION_PRESENCE_SLUG,
        refType: FOUNDATION_PRESENCE_REF_TYPE,
        refId: skillId,
      });
    }
  }

  return accepted;
}

type FoundationInstantCallSettings = { enabled: boolean; rateCredits: number | null; intervalMinutes: number };

type FoundationInstantCallRow = {
  instant_call_enabled: boolean;
  instant_call_rate_credits: number | null;
  instant_call_interval_minutes: number;
};

const FOUNDATION_INSTANT_CALL_DEFAULT_INTERVAL = 10;
const FOUNDATION_INSTANT_CALL_MIN_INTERVAL = 5;
const FOUNDATION_INSTANT_CALL_MAX_INTERVAL = 60;

function mapInstantCallRow(row: FoundationInstantCallRow | undefined): FoundationInstantCallSettings {
  if (!row) {
    return { enabled: false, rateCredits: null, intervalMinutes: FOUNDATION_INSTANT_CALL_DEFAULT_INTERVAL };
  }

  const rate = row.instant_call_rate_credits;
  return {
    enabled: Boolean(row.instant_call_enabled),
    rateCredits: rate === null || rate === undefined ? null : Number(rate),
    intervalMinutes: Number(row.instant_call_interval_minutes ?? FOUNDATION_INSTANT_CALL_DEFAULT_INTERVAL),
  };
}

// The provider's own instant 1:1 call settings (Foundation "Connect now", issue #808). enabled is the
// opt-in switch; rateCredits is whole ServiceCredits per block (only meaningful when enabled);
// intervalMinutes is the block length. A member with no row yet reads the off default.
export async function getOwnInstantCallSettings(userId: string): Promise<FoundationInstantCallSettings> {
  const result = await queryDb<FoundationInstantCallRow>(
    `
      SELECT instant_call_enabled, instant_call_rate_credits, instant_call_interval_minutes
      FROM foundation_user_extension
      WHERE user_id = $1
    `,
    [userId],
  );

  return mapInstantCallRow(result.rows[0]);
}

// Save the provider's instant-call settings. Validates before writing: when enabled, rateCredits must
// be a whole number >= 1 ('invalid_rate'); intervalMinutes must be a whole number in [5, 60]
// ('invalid_interval'). When disabled the rate is stored as given (or null). Upserts only the three
// settings columns + updated_at into foundation_user_extension, matching upsertNotificationPreferences.
export async function setOwnInstantCallSettings(
  userId: string,
  input: FoundationInstantCallSettings,
): Promise<FoundationInstantCallSettings> {
  const enabled = Boolean(input.enabled);
  const interval = input.intervalMinutes;
  if (
    !Number.isInteger(interval)
    || interval < FOUNDATION_INSTANT_CALL_MIN_INTERVAL
    || interval > FOUNDATION_INSTANT_CALL_MAX_INTERVAL
  ) {
    throw new Error('invalid_interval');
  }

  const rate = input.rateCredits;
  if (enabled && (!Number.isInteger(rate) || (rate as number) < 1)) {
    throw new Error('invalid_rate');
  }
  const rateToStore = rate === null || rate === undefined ? null : Number(rate);

  const updated = await queryDb<FoundationInstantCallRow>(
    `
      INSERT INTO foundation_user_extension
        (user_id, instant_call_enabled, instant_call_rate_credits, instant_call_interval_minutes)
      VALUES
        ($1, $2, $3, $4)
      ON CONFLICT (user_id)
      DO UPDATE SET
        instant_call_enabled = EXCLUDED.instant_call_enabled,
        instant_call_rate_credits = EXCLUDED.instant_call_rate_credits,
        instant_call_interval_minutes = EXCLUDED.instant_call_interval_minutes,
        updated_at = NOW()
      RETURNING instant_call_enabled, instant_call_rate_credits, instant_call_interval_minutes
    `,
    [userId, enabled, rateToStore, interval],
  );

  return mapInstantCallRow(updated.rows[0]);
}

export const FOUNDATION_SHORT_DESCRIPTION_MAX = 200;

// The provider's own short blurb shown on their Foundation listing. A member with no row yet, or a
// blank value, reads null. Trimmed for display so trailing whitespace never shows.
export async function getOwnProviderShortDescription(userId: string): Promise<string | null> {
  const result = await queryDb<{ short_description: string | null }>(
    `SELECT short_description FROM foundation_user_extension WHERE user_id = $1`,
    [userId],
  );
  const value = result.rows[0]?.short_description;
  return value && value.trim().length > 0 ? value.trim() : null;
}

// Save the provider's short blurb. A blank string clears it (stored as NULL). Anything longer than
// FOUNDATION_SHORT_DESCRIPTION_MAX after trimming throws 'invalid_short_description' so the route can
// return a clear member-facing 400. Upserts only this column + updated_at, matching the other
// per-field writers on foundation_user_extension.
export async function setOwnProviderShortDescription(userId: string, input: string): Promise<string | null> {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (trimmed.length > FOUNDATION_SHORT_DESCRIPTION_MAX) {
    throw new Error('invalid_short_description');
  }
  const toStore = trimmed.length > 0 ? trimmed : null;

  const updated = await queryDb<{ short_description: string | null }>(
    `
      INSERT INTO foundation_user_extension (user_id, short_description)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET
        short_description = EXCLUDED.short_description,
        updated_at = NOW()
      RETURNING short_description
    `,
    [userId, toStore],
  );

  const value = updated.rows[0]?.short_description;
  return value && value.trim().length > 0 ? value.trim() : null;
}

type FoundationThreadRow = {
  id: string;
  survivor_user_id: string;
  provider_user_id: string;
  provider_directory_profile_id: string;
  stream_channel_id: string;
  status: 'active' | 'closed';
  created_at: Date;
};

function mapThreadRow(row: FoundationThreadRow): FoundationThread {
  return {
    id: row.id,
    survivorUserId: row.survivor_user_id,
    providerUserId: row.provider_user_id,
    providerDirectoryProfileId: row.provider_directory_profile_id,
    streamChannelId: row.stream_channel_id,
    status: row.status,
    createdAtIso: toIso(row.created_at),
  };
}

type FoundationMessageRow = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  sender_role: 'survivor' | 'provider';
  message_text: string;
  stream_message_id: string | null;
  moderation_status: 'accepted' | 'flagged';
  created_at: Date;
};

function mapMessageRow(row: FoundationMessageRow): FoundationMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderUserId: row.sender_user_id,
    senderRole: row.sender_role,
    messageText: row.message_text,
    streamMessageId: row.stream_message_id,
    moderationStatus: row.moderation_status,
    createdAtIso: toIso(row.created_at),
  };
}

async function evaluateRateLimit(client: PoolClient, input: {
  userId: string;
  commandName: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; count: number }> {
  const now = new Date();
  const windowStartedAt = new Date(Math.floor(now.getTime() / (input.windowSeconds * 1000)) * input.windowSeconds * 1000);

  const upserted = await client.query<{ request_count: number }>(
    `
      INSERT INTO foundation_rate_limit_counters
        (user_id, command_name, window_started_at, window_seconds, request_count, updated_at)
      VALUES
        ($1, $2, $3, $4, 1, NOW())
      ON CONFLICT (user_id, command_name, window_started_at, window_seconds)
      DO UPDATE SET
        request_count = foundation_rate_limit_counters.request_count + 1,
        updated_at = NOW()
      RETURNING request_count
    `,
    [input.userId, input.commandName, windowStartedAt, input.windowSeconds],
  );

  const count = Number(upserted.rows[0]?.request_count ?? 0);
  return {
    allowed: count <= input.limit,
    count,
  };
}

async function assertConnectionThreadCapacity(client: PoolClient, actorUserId: string): Promise<void> {
  const [capacity, actorThreadCount] = await Promise.all([
    client.query<{ max_active_threads_per_user: number }>(
      `
        SELECT max_active_threads_per_user
        FROM foundation_capacity_policies
        WHERE singleton_key = TRUE
      `,
    ),
    client.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM foundation_connection_threads
        WHERE survivor_user_id = $1
          AND status = 'active'
      `,
      [actorUserId],
    ),
  ]);

  const maxActiveThreads = Number(capacity.rows[0]?.max_active_threads_per_user ?? 20);
  const activeThreads = parseCountRow(actorThreadCount.rows);
  if (activeThreads >= maxActiveThreads) {
    throw new Error('rate_limit_exceeded');
  }
}

type FoundationProviderLookupRow = {
  id: string;
  claimed_by_user_id: string;
  display_name: string;
};

async function getProviderForConnection(client: PoolClient, providerProfileId: string): Promise<FoundationProviderLookupRow> {
  const provider = await client.query<FoundationProviderLookupRow>(
    `
      SELECT id::text, claimed_by_user_id,
             TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS display_name
      FROM directory_profiles
      WHERE id = $1::uuid
        AND is_active = TRUE
        AND claimed_by_user_id IS NOT NULL
    `,
    [providerProfileId],
  );

  const row = provider.rows[0];
  if (!row) {
    throw new Error('provider_not_found');
  }

  return row;
}

async function getOrCreateConnectionThread(client: PoolClient, input: {
  actorUserId: string;
  actorDisplayName: string;
  providerProfileId: string;
  providerUserId: string;
  providerDisplayName: string;
}): Promise<FoundationThread> {
  const existing = await client.query<FoundationThreadRow>(
    `
      SELECT
        id::text,
        survivor_user_id,
        provider_user_id,
        provider_directory_profile_id::text,
        stream_channel_id,
        status,
        created_at
      FROM foundation_connection_threads
      WHERE survivor_user_id = $1
        AND provider_user_id = $2
    `,
    [input.actorUserId, input.providerUserId],
  );

  if (existing.rows.length > 0) {
    return mapThreadRow(existing.rows[0]);
  }

  const threadId = randomUUID();
  const stream = await ensureFoundationStreamChannel({
    threadId,
    survivorUserId: input.actorUserId,
    survivorDisplayName: input.actorDisplayName,
    providerUserId: input.providerUserId,
    providerDisplayName: input.providerDisplayName,
  });

  const streamChannelId = stream?.streamChannelId ?? `foundation-thread-${threadId}`;

  const inserted = await client.query<FoundationThreadRow>(
    `
      INSERT INTO foundation_connection_threads
        (id, survivor_user_id, provider_user_id, provider_directory_profile_id, stream_channel_id, created_by_user_id)
      VALUES
        ($1::uuid, $2, $3, $4, $5, $2)
      RETURNING
        id::text,
        survivor_user_id,
        provider_user_id,
        provider_directory_profile_id::text,
        stream_channel_id,
        status,
        created_at
    `,
    [threadId, input.actorUserId, input.providerUserId, input.providerProfileId, streamChannelId],
  );

  await client.query(
    `
      INSERT INTO foundation_thread_participants (thread_id, user_id, participant_role)
      VALUES
        ($1::uuid, $2, 'survivor'),
        ($1::uuid, $3, 'provider')
      ON CONFLICT (thread_id, user_id) DO NOTHING
    `,
    [threadId, input.actorUserId, input.providerUserId],
  );

  return mapThreadRow(inserted.rows[0]);
}

export async function createConnectionThread(input: {
  actorUserId: string;
  actorDisplayName: string;
  providerProfileId: string;
  idempotencyKey: string;
}): Promise<{
  thread: FoundationThread;
  streamApiKey: string | null;
  streamUserId: string | null;
  streamToken: string | null;
}> {
  return withDbTransaction(async (client) => {
    await assertConnectionThreadCapacity(client, input.actorUserId);

    const provider = await getProviderForConnection(client, input.providerProfileId);
    const providerUserId = provider.claimed_by_user_id;
    if (providerUserId === input.actorUserId) {
      throw new Error('policy_denied');
    }

    const thread = await getOrCreateConnectionThread(client, {
      actorUserId: input.actorUserId,
      actorDisplayName: input.actorDisplayName,
      providerProfileId: input.providerProfileId,
      providerUserId,
      providerDisplayName: provider.display_name,
    });

    const credentials = await createFoundationParticipantToken(input.actorUserId, input.actorDisplayName);

    return {
      thread,
      streamApiKey: credentials?.streamApiKey ?? null,
      streamUserId: credentials?.streamUserId ?? null,
      streamToken: credentials?.streamToken ?? null,
    };
  });
}

export async function sendMessageToThread(input: {
  threadId: string;
  actorUserId: string;
  actorDisplayName: string;
  messageText: string;
  attachments?: unknown;
  clientMessageId: string;
}): Promise<FoundationMessage> {
  return withDbTransaction(async (client) => {
    const thread = await client.query<FoundationThreadRow>(
      `
        SELECT
          t.id::text,
          t.survivor_user_id,
          t.provider_user_id,
          t.provider_directory_profile_id::text,
          t.stream_channel_id,
          t.status,
          t.created_at
        FROM foundation_connection_threads t
        JOIN foundation_thread_participants p ON p.thread_id = t.id
        WHERE t.id = $1::uuid
          AND p.user_id = $2
        LIMIT 1
      `,
      [input.threadId, input.actorUserId],
    );

    if (thread.rows.length === 0) {
      throw new Error('thread_not_found');
    }

    const rateLimit = await evaluateRateLimit(client, {
      userId: input.actorUserId,
      commandName: 'foundation.connection.message.send',
      limit: 20,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      throw new Error('rate_limit_exceeded');
    }

    const senderRole = thread.rows[0].survivor_user_id === input.actorUserId ? 'survivor' : 'provider';

    const streamMessageId = await sendFoundationStreamMessage({
      streamChannelId: thread.rows[0].stream_channel_id,
      senderUserId: input.actorUserId,
      senderDisplayName: input.actorDisplayName,
      messageText: input.messageText,
    });

    const inserted = await client.query<FoundationMessageRow>(
      `
        INSERT INTO foundation_message_metadata
          (thread_id, sender_user_id, sender_role, message_text, attachments, client_message_id, stream_message_id, moderation_status)
        VALUES
          ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, 'accepted')
        ON CONFLICT (thread_id, sender_user_id, client_message_id)
        DO UPDATE SET
          message_text = EXCLUDED.message_text,
          attachments = EXCLUDED.attachments,
          stream_message_id = COALESCE(EXCLUDED.stream_message_id, foundation_message_metadata.stream_message_id)
        RETURNING
          id::text,
          thread_id::text,
          sender_user_id,
          sender_role,
          message_text,
          stream_message_id,
          moderation_status,
          created_at
      `,
      [
        input.threadId,
        input.actorUserId,
        senderRole,
        input.messageText,
        JSON.stringify(parseJsonArray(input.attachments)),
        input.clientMessageId,
        streamMessageId,
      ],
    );

    const counterpartyUserId = senderRole === 'survivor' ? thread.rows[0].provider_user_id : thread.rows[0].survivor_user_id;

    await client.query(
      `
        INSERT INTO foundation_notification_events (user_id, thread_id, kind, title, body, metadata)
        VALUES ($1, $2::uuid, 'message.new', 'New message', 'You have a new Foundation message.', '{}'::jsonb)
      `,
      [counterpartyUserId, input.threadId],
    );

    return mapMessageRow(inserted.rows[0]);
  });
}

// Re-mint fresh Stream credentials for a member opening an existing connection thread's Direct Line.
// The caller must be a participant of the thread (the survivor or the provider); otherwise this
// throws 'thread_not_found' so a non-participant cannot learn the channel id. No new Stream channel
// is created here — the channel already exists from the Request-Quote handoff; this only looks up the
// thread's stream_channel_id and issues a token for this member.
export async function getThreadCredentialsForParticipant(input: {
  threadId: string;
  actorUserId: string;
  actorDisplayName: string;
}): Promise<{
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
  streamChannelId: string;
}> {
  return withDbTransaction(async (client) => {
    const thread = await client.query<{ stream_channel_id: string }>(
      `
        SELECT t.stream_channel_id
        FROM foundation_connection_threads t
        JOIN foundation_thread_participants p ON p.thread_id = t.id
        WHERE t.id = $1::uuid
          AND p.user_id = $2
        LIMIT 1
      `,
      [input.threadId, input.actorUserId],
    );

    if (thread.rows.length === 0) {
      throw new Error('thread_not_found');
    }

    const credentials = await createFoundationParticipantToken(input.actorUserId, input.actorDisplayName);
    if (!credentials) {
      throw new Error('stream_unavailable');
    }

    return {
      streamApiKey: credentials.streamApiKey,
      streamUserId: credentials.streamUserId,
      streamToken: credentials.streamToken,
      streamChannelId: thread.rows[0].stream_channel_id,
    };
  });
}

async function assertCallParticipantThread(client: PoolClient, threadId: string, actorUserId: string): Promise<void> {
  const thread = await client.query<FoundationThreadRow>(
    `
      SELECT
        t.id::text,
        t.survivor_user_id,
        t.provider_user_id,
        t.provider_directory_profile_id::text,
        t.stream_channel_id,
        t.status,
        t.created_at
      FROM foundation_connection_threads t
      JOIN foundation_thread_participants p ON p.thread_id = t.id
      WHERE t.id = $1::uuid
        AND p.user_id = $2
      LIMIT 1
    `,
    [threadId, actorUserId],
  );

  if (thread.rows.length === 0) {
    throw new Error('thread_not_found');
  }
}

async function getCallDurationLimitOrThrow(client: PoolClient): Promise<number> {
  const policyResult = await client.query<{ max_call_duration_minutes: number; quota_state: 'green' | 'yellow' | 'orange' | 'red' }>(
    `
      SELECT max_call_duration_minutes, quota_state
      FROM foundation_capacity_policies
      WHERE singleton_key = TRUE
    `,
  );

  const quotaState = policyResult.rows[0]?.quota_state ?? 'green';
  if (quotaState === 'red') {
    throw new Error('policy_denied');
  }

  return Number(policyResult.rows[0]?.max_call_duration_minutes ?? 45);
}

function resolveRequestedCallDuration(requestedDurationMinutes: number | undefined, maxDuration: number): number {
  if (Number.isInteger(requestedDurationMinutes)) {
    return Math.max(5, Math.min(maxDuration, Number(requestedDurationMinutes)));
  }

  return Math.min(30, maxDuration);
}

type FoundationCallSessionInsertRow = {
  id: string;
  thread_id: string;
  modality: FoundationCallModality;
  stream_call_id: string;
  requested_duration_minutes: number;
  status: 'created' | 'active' | 'ended' | 'cancelled';
  created_at: Date;
};

async function insertCallSessionRow(client: PoolClient, input: {
  threadId: string;
  actorUserId: string;
  modality: FoundationCallModality;
  requestedDuration: number;
}): Promise<FoundationCallSessionInsertRow> {
  const inserted = await client.query<FoundationCallSessionInsertRow>(
    `
      INSERT INTO foundation_call_sessions
        (thread_id, created_by_user_id, modality, stream_call_id, requested_duration_minutes, status)
      VALUES
        ($1::uuid, $2, $3, $4, $5, 'created')
      RETURNING
        id::text,
        thread_id::text,
        modality,
        stream_call_id,
        requested_duration_minutes,
        status,
        created_at
    `,
    [input.threadId, input.actorUserId, input.modality, `foundation-call-${randomUUID()}`, input.requestedDuration],
  );

  return inserted.rows[0];
}

export async function createCallSession(input: {
  threadId: string;
  actorUserId: string;
  actorDisplayName: string;
  modality: FoundationCallModality;
  requestedDurationMinutes?: number;
  idempotencyKey: string;
}): Promise<{
  callSession: FoundationCallSession;
  streamCallId: string;
  joinToken: string | null;
  streamApiKey: string | null;
  streamUserId: string | null;
  expiresAtIso: string;
}> {
  return withDbTransaction(async (client) => {
    await assertCallParticipantThread(client, input.threadId, input.actorUserId);

    const maxDuration = await getCallDurationLimitOrThrow(client);
    const requestedDuration = resolveRequestedCallDuration(input.requestedDurationMinutes, maxDuration);
    const row = await insertCallSessionRow(client, {
      threadId: input.threadId,
      actorUserId: input.actorUserId,
      modality: input.modality,
      requestedDuration,
    });

    const credentials = await createFoundationCallToken({
      userId: input.actorUserId,
      displayName: input.actorDisplayName,
    });

    const expiresAt = new Date(Date.now() + (60 * 60 * 1000));

    return {
      callSession: {
        id: row.id,
        threadId: row.thread_id,
        modality: row.modality,
        streamCallId: row.stream_call_id,
        requestedDurationMinutes: row.requested_duration_minutes,
        status: row.status,
        createdAtIso: toIso(row.created_at),
      },
      streamCallId: row.stream_call_id,
      joinToken: credentials?.streamToken ?? null,
      streamApiKey: credentials?.streamApiKey ?? null,
      streamUserId: credentials?.streamUserId ?? null,
      expiresAtIso: expiresAt.toISOString(),
    };
  });
}

type FoundationQuoteRow = {
  id: string;
  thread_id: string;
  survivor_user_id: string;
  provider_user_id: string;
  service_type: string;
  lifecycle_state: FoundationQuoteState;
  quoted_amount: string | null;
  quoted_currency: string | null;
  settled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function mapQuoteRow(row: FoundationQuoteRow): FoundationQuoteRequest {
  return {
    id: row.id,
    threadId: row.thread_id,
    survivorUserId: row.survivor_user_id,
    providerUserId: row.provider_user_id,
    serviceType: row.service_type,
    lifecycleState: row.lifecycle_state,
    quotedAmount: row.quoted_amount === null ? null : Number(row.quoted_amount),
    quotedCurrency: row.quoted_currency,
    settledAtIso: row.settled_at ? toIso(row.settled_at) : null,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

export async function createQuoteRequest(input: {
  threadId: string;
  actorUserId: string;
  serviceType: string;
  requestDetails: unknown;
  idempotencyKey: string;
}): Promise<FoundationQuoteRequest> {
  return withDbTransaction(async (client) => {
    const thread = await client.query<FoundationThreadRow>(
      `
        SELECT
          t.id::text,
          t.survivor_user_id,
          t.provider_user_id,
          t.provider_directory_profile_id::text,
          t.stream_channel_id,
          t.status,
          t.created_at
        FROM foundation_connection_threads t
        WHERE t.id = $1::uuid
      `,
      [input.threadId],
    );

    if (thread.rows.length === 0) {
      throw new Error('thread_not_found');
    }

    const row = thread.rows[0];
    if (row.survivor_user_id !== input.actorUserId) {
      throw new Error('policy_denied');
    }

    const rateLimit = await evaluateRateLimit(client, {
      userId: input.actorUserId,
      commandName: 'foundation.quote.request.create',
      limit: 20,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      throw new Error('rate_limit_exceeded');
    }

    const inserted = await client.query<FoundationQuoteRow>(
      `
        INSERT INTO foundation_quote_requests
          (thread_id, survivor_user_id, provider_user_id, service_type, request_details, lifecycle_state, last_transitioned_at)
        VALUES
          ($1::uuid, $2, $3, $4, $5::jsonb, 'requested', NOW())
        RETURNING
          id::text,
          thread_id::text,
          survivor_user_id,
          provider_user_id,
          service_type,
          lifecycle_state,
          quoted_amount,
          quoted_currency,
          settled_at,
          created_at,
          updated_at
      `,
      [input.threadId, row.survivor_user_id, row.provider_user_id, input.serviceType, JSON.stringify(parseJsonObject(input.requestDetails))],
    );

    await client.query(
      `
        INSERT INTO foundation_quote_status_events
          (quote_request_id, actor_user_id, previous_state, current_state, reason, metadata)
        VALUES
          ($1::uuid, $2, NULL, 'requested', 'initial_create', '{}'::jsonb)
      `,
      [inserted.rows[0].id, input.actorUserId],
    );

    await client.query(
      `
        INSERT INTO foundation_notification_events
          (user_id, thread_id, quote_request_id, kind, title, body, metadata)
        VALUES
          ($1, $2::uuid, $3::uuid, 'quote.requested', 'Quote requested', 'A new quote request needs your response.', '{}'::jsonb)
      `,
      [row.provider_user_id, input.threadId, inserted.rows[0].id],
    );

    return mapQuoteRow(inserted.rows[0]);
  });
}

function canTransitionQuote(previousState: FoundationQuoteState, targetState: FoundationQuoteState): boolean {
  if (previousState === targetState) {
    return true;
  }

  if (previousState === 'requested' && (targetState === 'provider_responded' || targetState === 'closed')) {
    return true;
  }

  if (previousState === 'provider_responded' && targetState === 'closed') {
    return true;
  }

  return false;
}

function assertProviderResponsePayload(
  quote: FoundationQuoteRow,
  input: {
    targetState: FoundationQuoteState;
    actorUserId: string;
    quotedAmount?: number | null;
    quotedCurrency?: string | null;
  },
): void {
  // Only the provider attaches a price, and only on the 'provider_responded' transition. The survivor
  // may move the quote through its lifecycle but can never set the quoted amount/currency.
  if (input.targetState === 'provider_responded') {
    if (input.actorUserId !== quote.provider_user_id) {
      throw new Error('policy_denied');
    }
    const amountOk = typeof input.quotedAmount === 'number'
      && Number.isFinite(input.quotedAmount)
      && input.quotedAmount >= 0;
    const currencyOk = typeof input.quotedCurrency === 'string' && input.quotedCurrency.trim().length > 0;
    if (!amountOk || !currencyOk) {
      throw new Error('invalid_payload');
    }
  }
}

export async function updateQuoteRequestState(input: {
  quoteRequestId: string;
  actorUserId: string;
  targetState: FoundationQuoteState;
  transitionReason?: string;
  quotedAmount?: number | null;
  quotedCurrency?: string | null;
  idempotencyKey: string;
}): Promise<{ quote: FoundationQuoteRequest; previousState: FoundationQuoteState }> {
  return withDbTransaction(async (client) => {
    const existing = await client.query<FoundationQuoteRow>(
      `
        SELECT
          id::text,
          thread_id::text,
          survivor_user_id,
          provider_user_id,
          service_type,
          lifecycle_state,
          quoted_amount,
          quoted_currency,
          settled_at,
          created_at,
          updated_at
        FROM foundation_quote_requests
        WHERE id = $1::uuid
      `,
      [input.quoteRequestId],
    );

    if (existing.rows.length === 0) {
      throw new Error('quote_not_found');
    }

    const quote = existing.rows[0];
    if (quote.survivor_user_id !== input.actorUserId && quote.provider_user_id !== input.actorUserId) {
      throw new Error('policy_denied');
    }

    assertProviderResponsePayload(quote, input);

    if (!canTransitionQuote(quote.lifecycle_state, input.targetState)) {
      throw new Error('invalid_quote_transition');
    }

    const transitionReason = input.transitionReason ?? null;

    // Persist the price only on 'provider_responded'; stamp settled_at on 'closed' when the quote carries
    // a value (the CASE reads the pre-update quoted_amount, which is what we want). settled_at feeds GDP.
    const updated = await client.query<FoundationQuoteRow>(
      `
        UPDATE foundation_quote_requests
        SET lifecycle_state = $2,
            last_transitioned_at = NOW(),
            updated_at = NOW(),
            quoted_amount = CASE WHEN $2 = 'provider_responded' THEN $5::numeric ELSE quoted_amount END,
            quoted_currency = CASE WHEN $2 = 'provider_responded' THEN $6 ELSE quoted_currency END,
            settled_at = CASE WHEN $2 = 'closed' AND quoted_amount IS NOT NULL THEN NOW() ELSE settled_at END
        WHERE id = $1::uuid
        RETURNING
          id::text,
          thread_id::text,
          survivor_user_id,
          provider_user_id,
          service_type,
          lifecycle_state,
          quoted_amount,
          quoted_currency,
          settled_at,
          created_at,
          updated_at
      `,
      [
        input.quoteRequestId,
        input.targetState,
        quote.lifecycle_state,
        transitionReason,
        input.quotedAmount ?? null,
        input.quotedCurrency ?? null,
      ],
    );

    await client.query(
      `
        INSERT INTO foundation_quote_status_events
          (quote_request_id, actor_user_id, previous_state, current_state, reason, metadata)
        VALUES
          ($1::uuid, $2, $3, $4, $5, '{}'::jsonb)
      `,
      [input.quoteRequestId, input.actorUserId, quote.lifecycle_state, input.targetState, transitionReason],
    );

    const recipient = quote.provider_user_id === input.actorUserId ? quote.survivor_user_id : quote.provider_user_id;
    await client.query(
      `
        INSERT INTO foundation_notification_events
          (user_id, thread_id, quote_request_id, kind, title, body, metadata)
        VALUES
          ($1, $2::uuid, $3::uuid, 'quote.state.updated', 'Quote updated', 'A quote lifecycle state was updated.', '{}'::jsonb)
      `,
      [recipient, quote.thread_id, quote.id],
    );

    return {
      quote: mapQuoteRow(updated.rows[0]),
      previousState: quote.lifecycle_state,
    };
  });
}

export async function listQuoteHistory(input: {
  actorUserId: string;
  actorScope?: 'survivor' | 'provider';
  statusFilter?: FoundationQuoteState[];
  page?: number;
  pageSize?: number;
}): Promise<{ items: FoundationQuoteRequest[]; total: number; pagination: { page: number; pageSize: number } }> {
  const paging = normalizePage(input.page, input.pageSize);
  const statuses = (input.statusFilter ?? []).filter((status) => FOUNDATION_QUOTE_STATES.includes(status));

  const [count, items] = await Promise.all([
    queryDb<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM foundation_quote_requests
        WHERE (
          ($1 = 'survivor' AND survivor_user_id = $2)
          OR ($1 = 'provider' AND provider_user_id = $2)
          OR ($1 = 'all' AND (survivor_user_id = $2 OR provider_user_id = $2))
        )
        AND (
          $3::text[] IS NULL
          OR lifecycle_state = ANY($3::text[])
        )
      `,
      [input.actorScope ?? 'all', input.actorUserId, statuses.length > 0 ? statuses : null],
    ),
    queryDb<FoundationQuoteRow>(
      `
        SELECT
          id::text,
          thread_id::text,
          survivor_user_id,
          provider_user_id,
          service_type,
          lifecycle_state,
          quoted_amount,
          quoted_currency,
          settled_at,
          created_at,
          updated_at
        FROM foundation_quote_requests
        WHERE (
          ($1 = 'survivor' AND survivor_user_id = $2)
          OR ($1 = 'provider' AND provider_user_id = $2)
          OR ($1 = 'all' AND (survivor_user_id = $2 OR provider_user_id = $2))
        )
        AND (
          $3::text[] IS NULL
          OR lifecycle_state = ANY($3::text[])
        )
        ORDER BY updated_at DESC
        LIMIT $4 OFFSET $5
      `,
      [input.actorScope ?? 'all', input.actorUserId, statuses.length > 0 ? statuses : null, paging.pageSize, paging.offset],
    ),
  ]);

  return {
    items: items.rows.map(mapQuoteRow),
    total: Number.parseInt(count.rows[0]?.total ?? '0', 10),
    pagination: {
      page: paging.page,
      pageSize: paging.pageSize,
    },
  };
}

export async function listConnectionHistory(input: {
  actorUserId: string;
  includeMessages: boolean;
  includeCalls: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{
  threads: FoundationThread[];
  messages: FoundationMessage[];
  calls: FoundationCallSession[];
}> {
  const paging = normalizePage(input.page, input.pageSize);

  const threadRows = await queryDb<FoundationThreadRow>(
    `
      SELECT
        id::text,
        survivor_user_id,
        provider_user_id,
        provider_directory_profile_id::text,
        stream_channel_id,
        status,
        created_at
      FROM foundation_connection_threads
      WHERE survivor_user_id = $1 OR provider_user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3
    `,
    [input.actorUserId, paging.pageSize, paging.offset],
  );

  const threadIds = threadRows.rows.map((row) => row.id);

  const messageRows = input.includeMessages && threadIds.length > 0
    ? await queryDb<FoundationMessageRow>(
      `
        SELECT
          id::text,
          thread_id::text,
          sender_user_id,
          sender_role,
          message_text,
          stream_message_id,
          moderation_status,
          created_at
        FROM foundation_message_metadata
        WHERE thread_id = ANY($1::uuid[])
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [threadIds],
    )
    : { rows: [] as FoundationMessageRow[] };

  const callRows = input.includeCalls && threadIds.length > 0
    ? await queryDb<{
      id: string;
      thread_id: string;
      modality: FoundationCallModality;
      stream_call_id: string;
      requested_duration_minutes: number;
      status: 'created' | 'active' | 'ended' | 'cancelled';
      created_at: Date;
    }>(
      `
        SELECT
          id::text,
          thread_id::text,
          modality,
          stream_call_id,
          requested_duration_minutes,
          status,
          created_at
        FROM foundation_call_sessions
        WHERE thread_id = ANY($1::uuid[])
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [threadIds],
    )
    : { rows: [] as Array<{
      id: string;
      thread_id: string;
      modality: FoundationCallModality;
      stream_call_id: string;
      requested_duration_minutes: number;
      status: 'created' | 'active' | 'ended' | 'cancelled';
      created_at: Date;
    }> };

  return {
    threads: threadRows.rows.map(mapThreadRow),
    messages: messageRows.rows.map(mapMessageRow),
    calls: callRows.rows.map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      modality: row.modality,
      streamCallId: row.stream_call_id,
      requestedDurationMinutes: row.requested_duration_minutes,
      status: row.status,
      createdAtIso: toIso(row.created_at),
    })),
  };
}

export async function upsertNotificationPreferences(input: {
  actorUserId: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled?: boolean;
  quietHours?: unknown;
}): Promise<{ notificationPreferenceId: string; updatedAtIso: string; effectiveChannels: string[] }> {
  return withDbTransaction(async (client) => {
    const preferencePayload = {
      inAppEnabled: Boolean(input.inAppEnabled),
      pushEnabled: Boolean(input.pushEnabled),
      emailEnabled: Boolean(input.emailEnabled ?? false),
      quietHours: parseJsonObject(input.quietHours),
    };

    const updated = await client.query<{ user_id: string; updated_at: Date }>(
      `
        INSERT INTO foundation_user_extension
          (user_id, notification_preferences, accessibility_runtime_prefs, trauma_informed_defaults)
        VALUES
          ($1, $2::jsonb, '{}'::jsonb, '{}'::jsonb)
        ON CONFLICT (user_id)
        DO UPDATE SET
          notification_preferences = EXCLUDED.notification_preferences,
          updated_at = NOW()
        RETURNING user_id, updated_at
      `,
      [input.actorUserId, JSON.stringify(preferencePayload)],
    );

    const effectiveChannels: string[] = [];
    if (preferencePayload.inAppEnabled) effectiveChannels.push('in_app');
    if (preferencePayload.pushEnabled) effectiveChannels.push('push');
    if (preferencePayload.emailEnabled) effectiveChannels.push('email');

    return {
      notificationPreferenceId: updated.rows[0].user_id,
      updatedAtIso: toIso(updated.rows[0].updated_at),
      effectiveChannels,
    };
  });
}

export async function listNotificationEvents(userId: string, onlyUnacknowledged: boolean): Promise<FoundationNotificationEvent[]> {
  const result = await queryDb<{
    id: string;
    user_id: string;
    kind: string;
    title: string;
    body: string;
    is_acknowledged: boolean;
    created_at: Date;
  }>(
    `
      SELECT
        id::text,
        user_id,
        kind,
        title,
        body,
        is_acknowledged,
        created_at
      FROM foundation_notification_events
      WHERE user_id = $1
        AND ($2 = FALSE OR is_acknowledged = FALSE)
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [userId, onlyUnacknowledged],
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    isAcknowledged: row.is_acknowledged,
    createdAtIso: toIso(row.created_at),
  }));
}

export async function ackNotificationEvent(input: {
  actorUserId: string;
  notificationEventId: string;
}): Promise<FoundationNotificationEvent | null> {
  const updated = await queryDb<{
    id: string;
    user_id: string;
    kind: string;
    title: string;
    body: string;
    is_acknowledged: boolean;
    created_at: Date;
  }>(
    `
      UPDATE foundation_notification_events
      SET is_acknowledged = TRUE,
          acknowledged_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2
      RETURNING
        id::text,
        user_id,
        kind,
        title,
        body,
        is_acknowledged,
        created_at
    `,
    [input.notificationEventId, input.actorUserId],
  );

  if (updated.rows.length === 0) {
    return null;
  }

  const row = updated.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    isAcknowledged: row.is_acknowledged,
    createdAtIso: toIso(row.created_at),
  };
}

export async function getCapacityPolicy(): Promise<FoundationCapacityPolicy> {
  const result = await queryDb<{
    max_active_threads_per_user: number;
    max_messages_per_minute: number;
    max_searches_per_minute: number;
    max_quote_transitions_per_minute: number;
    max_call_duration_minutes: number;
    quota_state: 'green' | 'yellow' | 'orange' | 'red';
    updated_at: Date;
  }>(
    `
      SELECT
        max_active_threads_per_user,
        max_messages_per_minute,
        max_searches_per_minute,
        max_quote_transitions_per_minute,
        max_call_duration_minutes,
        quota_state,
        updated_at
      FROM foundation_capacity_policies
      WHERE singleton_key = TRUE
      LIMIT 1
    `,
  );

  const row = result.rows[0];
  if (!row) {
    return {
      maxActiveThreadsPerUser: 20,
      maxMessagesPerMinute: 20,
      maxSearchesPerMinute: 40,
      maxQuoteTransitionsPerMinute: 20,
      maxCallDurationMinutes: 45,
      quotaState: 'green',
      updatedAtIso: new Date().toISOString(),
      policyVersion: null,
      activatedAtIso: null,
    };
  }

  // The current version comes from the append-only event log (issue #1960): the highest policy_version
  // and when it activated. Both are null on a policy that has never been updated through the events path.
  const latestEvent = await queryDb<{ policy_version: number; activated_at: Date }>(
    `
      SELECT policy_version, activated_at
      FROM foundation_capacity_policy_events
      ORDER BY policy_version DESC
      LIMIT 1
    `,
  );
  const eventRow = latestEvent.rows[0];

  return {
    maxActiveThreadsPerUser: row.max_active_threads_per_user,
    maxMessagesPerMinute: row.max_messages_per_minute,
    maxSearchesPerMinute: row.max_searches_per_minute,
    maxQuoteTransitionsPerMinute: row.max_quote_transitions_per_minute,
    maxCallDurationMinutes: row.max_call_duration_minutes,
    quotaState: row.quota_state,
    updatedAtIso: toIso(row.updated_at),
    policyVersion: eventRow ? Number(eventRow.policy_version) : null,
    activatedAtIso: eventRow ? toIso(eventRow.activated_at) : null,
  };
}

export async function updateCapacityPolicy(input: {
  actorUserId: string;
  maxActiveThreadsPerUser: number;
  maxMessagesPerMinute: number;
  maxSearchesPerMinute: number;
  maxQuoteTransitionsPerMinute: number;
  maxCallDurationMinutes: number;
  quotaState: 'green' | 'yellow' | 'orange' | 'red';
}): Promise<FoundationCapacityPolicy> {
  return withDbTransaction(async (client) => {
    const updated = await client.query<{
      max_active_threads_per_user: number;
      max_messages_per_minute: number;
      max_searches_per_minute: number;
      max_quote_transitions_per_minute: number;
      max_call_duration_minutes: number;
      quota_state: 'green' | 'yellow' | 'orange' | 'red';
      updated_at: Date;
    }>(
      `
        INSERT INTO foundation_capacity_policies
          (singleton_key, max_active_threads_per_user, max_messages_per_minute, max_searches_per_minute, max_quote_transitions_per_minute, max_call_duration_minutes, quota_state, updated_by_user_id)
        VALUES
          (TRUE, $1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (singleton_key)
        DO UPDATE SET
          max_active_threads_per_user = EXCLUDED.max_active_threads_per_user,
          max_messages_per_minute = EXCLUDED.max_messages_per_minute,
          max_searches_per_minute = EXCLUDED.max_searches_per_minute,
          max_quote_transitions_per_minute = EXCLUDED.max_quote_transitions_per_minute,
          max_call_duration_minutes = EXCLUDED.max_call_duration_minutes,
          quota_state = EXCLUDED.quota_state,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
        RETURNING
          max_active_threads_per_user,
          max_messages_per_minute,
          max_searches_per_minute,
          max_quote_transitions_per_minute,
          max_call_duration_minutes,
          quota_state,
          updated_at
      `,
      [
        input.maxActiveThreadsPerUser,
        input.maxMessagesPerMinute,
        input.maxSearchesPerMinute,
        input.maxQuoteTransitionsPerMinute,
        input.maxCallDurationMinutes,
        input.quotaState,
        input.actorUserId,
      ],
    );

    const row = updated.rows[0];

    // Record this change as a versioned, append-only event (issue #1960): a monotonic policy_version, the
    // full snapshot of the new values, who changed it, and when it activated. MAX+1 is safe inside this
    // transaction — the policy is a singleton and only admins update it, so there is no real contention.
    const versionResult = await client.query<{ next_version: string }>(
      `SELECT (COALESCE(MAX(policy_version), 0) + 1)::text AS next_version FROM foundation_capacity_policy_events`,
    );
    const policyVersion = Number.parseInt(versionResult.rows[0]?.next_version ?? '1', 10);
    const eventResult = await client.query<{ activated_at: Date }>(
      `
        INSERT INTO foundation_capacity_policy_events
          (policy_version, max_active_threads_per_user, max_messages_per_minute, max_searches_per_minute,
           max_quote_transitions_per_minute, max_call_duration_minutes, quota_state, changed_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING activated_at
      `,
      [
        policyVersion,
        row.max_active_threads_per_user,
        row.max_messages_per_minute,
        row.max_searches_per_minute,
        row.max_quote_transitions_per_minute,
        row.max_call_duration_minutes,
        row.quota_state,
        input.actorUserId,
      ],
    );

    return {
      maxActiveThreadsPerUser: row.max_active_threads_per_user,
      maxMessagesPerMinute: row.max_messages_per_minute,
      maxSearchesPerMinute: row.max_searches_per_minute,
      maxQuoteTransitionsPerMinute: row.max_quote_transitions_per_minute,
      maxCallDurationMinutes: row.max_call_duration_minutes,
      quotaState: row.quota_state,
      updatedAtIso: toIso(row.updated_at),
      policyVersion,
      activatedAtIso: toIso(eventResult.rows[0].activated_at),
    };
  });
}

export async function evaluateRateLimitCommand(input: {
  userId: string;
  commandName: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; currentCount: number; limit: number; thresholdBand: 'green' | 'yellow' | 'orange' | 'red' }> {
  return withDbTransaction(async (client) => {
    const result = await evaluateRateLimit(client, {
      userId: input.userId,
      commandName: input.commandName,
      limit: input.limit,
      windowSeconds: input.windowSeconds,
    });

    const ratio = input.limit > 0 ? result.count / input.limit : 1;
    const thresholdBand = ratio >= 0.95 ? 'red' : ratio >= 0.85 ? 'orange' : ratio >= 0.7 ? 'yellow' : 'green';

    return {
      allowed: result.allowed,
      currentCount: result.count,
      limit: input.limit,
      thresholdBand,
    };
  });
}

export async function insertFoundationAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await queryDb(
    `
      INSERT INTO foundation_admin_audit_trail
        (actor_id, command, policy_status, reason, target_type, target_id, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [input.actorId, input.command, input.policyStatus, input.reason, input.targetType, input.targetId, JSON.stringify(input.metadata ?? {})],
  );
}

export async function listFoundationAuditEvents(limit = 100): Promise<Array<{
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAtIso: string;
}>> {
  const boundedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const result = await queryDb<{
    actor_id: string;
    command: string;
    policy_status: 'allow' | 'deny';
    reason: string;
    target_type: string;
    target_id: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `
      SELECT actor_id, command, policy_status, reason, target_type, target_id, metadata, created_at
      FROM foundation_admin_audit_trail
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [boundedLimit],
  );

  return result.rows.map((row) => ({
    actorId: row.actor_id,
    command: row.command,
    policyStatus: row.policy_status,
    reason: row.reason,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: parseJsonObject(row.metadata),
    createdAtIso: toIso(row.created_at),
  }));
}

export async function getFoundationDashboard(): Promise<{
  providersTotal: number;
  threadsTotal: number;
  quotesTotal: number;
  activeCallsTotal: number;
  pendingNotificationsTotal: number;
  generatedAtIso: string;
}> {
  const [providers, threads, quotes, activeCalls, pendingNotifications] = await Promise.all([
    // Count Foundation providers the same way Browse does: a claimed, active directory profile that has
    // opted in by offering at least one skill (a foundation_provider_skills row). Without the EXISTS
    // clause this counted every claimed Directory member, so the admin "Providers" stat could read (say)
    // 8 while Browse showed only 1 — the 7 others are Directory members who never opted into Foundation.
    queryDb<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM directory_profiles dp
       WHERE dp.is_active = TRUE
         AND dp.claimed_by_user_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM foundation_provider_skills fps WHERE fps.user_id = dp.claimed_by_user_id)`,
    ),
    queryDb<{ total: string }>(`SELECT COUNT(*)::text AS total FROM foundation_connection_threads`),
    queryDb<{ total: string }>(`SELECT COUNT(*)::text AS total FROM foundation_quote_requests`),
    queryDb<{ total: string }>(`SELECT COUNT(*)::text AS total FROM foundation_call_sessions WHERE status IN ('created', 'active')`),
    queryDb<{ total: string }>(`SELECT COUNT(*)::text AS total FROM foundation_notification_events WHERE is_acknowledged = FALSE`),
  ]);

  return {
    providersTotal: parseCountRow(providers.rows),
    threadsTotal: parseCountRow(threads.rows),
    quotesTotal: parseCountRow(quotes.rows),
    activeCallsTotal: parseCountRow(activeCalls.rows),
    pendingNotificationsTotal: parseCountRow(pendingNotifications.rows),
    generatedAtIso: new Date().toISOString(),
  };
}
