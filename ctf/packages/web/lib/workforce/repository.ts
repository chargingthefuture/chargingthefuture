import { createHash } from 'crypto';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  WORKFORCE_DEFAULT_PAGE,
  WORKFORCE_DEFAULT_PAGE_SIZE,
  WORKFORCE_DEFAULT_TIMEZONE,
  WORKFORCE_DEFAULT_WEEK_START_DOW,
  WORKFORCE_MAX_ANNOUNCEMENT_BODY_LENGTH,
  WORKFORCE_MAX_ANNOUNCEMENT_TITLE_LENGTH,
  WORKFORCE_MAX_OCCUPATION_NAME_LENGTH,
  WORKFORCE_MAX_PAGE_SIZE,
  WORKFORCE_MAX_REGION_LENGTH,
} from './constants';
import type {
  WorkforceAnnouncement,
  WorkforceAnnouncementInput,
  WorkforceConfig,
  WorkforceConfigInput,
  WorkforceDashboard,
  WorkforceExportJob,
  WorkforceGroupedReportItem,
  WorkforceOccupation,
  WorkforceOccupationInput,
  WorkforcePagination,
  WorkforceProfile,
  WorkforceProfileInput,
  WorkforceSummaryReport,
} from './types';

type CountRow = { total: string };

type WorkforceProfileRow = {
  user_id: string;
  occupation_id: string | null;
  occupation_name: string | null;
  skill_level: string;
  region: string | null;
  recruited_state: boolean;
  recruited_resolved_at: Date | null;
  availability_preferences: Record<string, unknown>;
  work_preferences: Record<string, unknown>;
  service_deleted_at: Date | null;
  updated_at: Date;
};

type WorkforceOccupationRow = {
  id: string;
  name: string;
  sector: string | null;
  is_active: boolean;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type WorkforceAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  published_at: Date;
  expires_at: Date | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type WorkforceConfigRow = {
  exports_enabled: boolean;
  kill_switch_enabled: boolean;
  report_week_timezone: string;
  report_week_start_dow: number;
  updated_by_user_id: string;
  updated_at: Date;
};

type WorkforceReportRow = {
  workforce_total: number;
  recruited_total: number;
};

type WorkforceGroupedRow = {
  bucket: string;
  workforce_total: string;
  recruited_total: string;
};

type WorkforceAuditRow = {
  id: string;
  actor_id: string;
  command: string;
  policy_status: 'allow' | 'deny';
  reason: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

type WorkforceDirectoryDeltaRow = {
  id: string;
  claimed_by_user_id: string | null;
  updated_at: Date;
};

type WorkforceSyncCursorRow = {
  last_cursor_at: Date;
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

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function isValidIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function mapWorkforceProfile(row: WorkforceProfileRow): WorkforceProfile {
  return {
    userId: row.user_id,
    occupationId: row.occupation_id,
    occupationName: row.occupation_name,
    skillLevel: row.skill_level,
    region: row.region,
    recruitedState: row.recruited_state,
    recruitedResolvedAtIso: row.recruited_resolved_at ? toIso(row.recruited_resolved_at) : null,
    availabilityPreferences: normalizeJsonObject(row.availability_preferences),
    workPreferences: normalizeJsonObject(row.work_preferences),
    serviceDeletedAtIso: row.service_deleted_at ? toIso(row.service_deleted_at) : null,
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapOccupation(row: WorkforceOccupationRow): WorkforceOccupation {
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    isActive: row.is_active,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapAnnouncement(row: WorkforceAnnouncementRow): WorkforceAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isActive: row.is_active,
    publishedAtIso: toIso(row.published_at),
    expiresAtIso: row.expires_at ? toIso(row.expires_at) : null,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapConfig(row: WorkforceConfigRow): WorkforceConfig {
  return {
    exportsEnabled: row.exports_enabled,
    killSwitchEnabled: row.kill_switch_enabled,
    reportWeekTimezone: row.report_week_timezone,
    reportWeekStartDow: row.report_week_start_dow,
    updatedByUserId: row.updated_by_user_id,
    updatedAtIso: toIso(row.updated_at),
  };
}

function normalizeSkillLevel(value: string | null | undefined): string {
  if (!value) {
    return 'unknown';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return 'unknown';
  }

  return normalized;
}

export function parsePaginationParams(url: string): { page: number; pageSize: number } {
  const params = new URL(url).searchParams;
  const pageRaw = Number.parseInt(params.get('page') ?? '', 10);
  const pageSizeRaw = Number.parseInt(params.get('pageSize') ?? '', 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : WORKFORCE_DEFAULT_PAGE;
  const pageSizeBase = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : WORKFORCE_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(pageSizeBase, WORKFORCE_MAX_PAGE_SIZE);

  return { page, pageSize };
}

export function validateProfileInput(input: WorkforceProfileInput): boolean {
  const region = normalizeNullableText(input.region);
  const skillLevel = normalizeSkillLevel(input.skillLevel);

  const checks = [
    !region || region.length <= WORKFORCE_MAX_REGION_LENGTH,
    skillLevel.length > 0 && skillLevel.length <= 40,
    input.occupationId === null || typeof input.occupationId === 'string',
  ];

  return checks.every(Boolean);
}

export function validateOccupationInput(input: WorkforceOccupationInput): boolean {
  const name = normalizeText(input.name ?? '');
  const sector = normalizeNullableText(input.sector);

  return name.length > 0
    && name.length <= WORKFORCE_MAX_OCCUPATION_NAME_LENGTH
    && (!sector || sector.length <= 80)
    && (input.isActive === undefined || typeof input.isActive === 'boolean');
}

export function validateAnnouncementInput(input: WorkforceAnnouncementInput): boolean {
  const title = normalizeText(input.title ?? '');
  const body = normalizeText(input.body ?? '');

  return title.length > 0
    && title.length <= WORKFORCE_MAX_ANNOUNCEMENT_TITLE_LENGTH
    && body.length > 0
    && body.length <= WORKFORCE_MAX_ANNOUNCEMENT_BODY_LENGTH
    && (!input.expiresAtIso || isValidIsoDatetime(input.expiresAtIso));
}

export function validateConfigInput(input: WorkforceConfigInput): boolean {
  const timezone = normalizeText(input.reportWeekTimezone ?? '');

  return typeof input.exportsEnabled === 'boolean'
    && typeof input.killSwitchEnabled === 'boolean'
    && timezone.length > 0
    && timezone.length <= 64
    && Number.isInteger(input.reportWeekStartDow)
    && input.reportWeekStartDow >= 0
    && input.reportWeekStartDow <= 6;
}

async function ensureOccupationExists(occupationId: string | null): Promise<void> {
  if (!occupationId) {
    return;
  }

  const result = await queryDb<{ id: string }>(
    'SELECT id FROM workforce_occupations WHERE id = $1::uuid AND is_active = true LIMIT 1',
    [occupationId],
  );

  if (result.rows.length === 0) {
    throw new Error('workforce_occupation_not_found');
  }
}

export async function getDashboard(): Promise<WorkforceDashboard> {
  // Directory (+ Skills Taxonomy) is the single source of truth: the workforce population IS the
  // active directory profiles, and "recruited" means a profile that has been claimed by a user.
  // We read directory_profiles live rather than keeping a synced workforce_profiles copy, so the
  // numbers can never drift and there is no sync job to fail.
  const [workforceCount, recruitedCount, occupationCount, activeAnnouncementCount] = await Promise.all([
    queryDb<CountRow>("SELECT COUNT(*)::text AS total FROM directory_profiles WHERE is_active = TRUE AND deleted_at IS NULL"),
    queryDb<CountRow>("SELECT COUNT(*)::text AS total FROM directory_profiles WHERE is_active = TRUE AND deleted_at IS NULL AND claimed_by_user_id IS NOT NULL"),
    queryDb<CountRow>('SELECT COUNT(*)::text AS total FROM workforce_occupations WHERE is_active = true'),
    queryDb<CountRow>('SELECT COUNT(*)::text AS total FROM workforce_announcements WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())'),
  ]);

  return {
    workforceTotal: Number.parseInt(workforceCount.rows[0]?.total ?? '0', 10),
    recruitedTotal: Number.parseInt(recruitedCount.rows[0]?.total ?? '0', 10),
    occupationsTotal: Number.parseInt(occupationCount.rows[0]?.total ?? '0', 10),
    activeAnnouncementsTotal: Number.parseInt(activeAnnouncementCount.rows[0]?.total ?? '0', 10),
    generatedAtIso: new Date().toISOString(),
  };
}

export async function getOwnProfile(userId: string): Promise<WorkforceProfile | null> {
  const result = await queryDb<WorkforceProfileRow>(
    `
      SELECT
        p.user_id,
        p.occupation_id,
        o.name AS occupation_name,
        p.skill_level,
        p.region,
        p.recruited_state,
        p.recruited_resolved_at,
        COALESCE(ue.availability_preferences, '{}'::jsonb) AS availability_preferences,
        COALESCE(ue.work_preferences, '{}'::jsonb) AS work_preferences,
        ue.service_deleted_at,
        GREATEST(p.updated_at, COALESCE(ue.updated_at, p.updated_at)) AS updated_at
      FROM workforce_profiles p
      LEFT JOIN workforce_user_extension ue ON ue.user_id = p.user_id
      LEFT JOIN workforce_occupations o ON o.id = p.occupation_id
      WHERE p.user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapWorkforceProfile(result.rows[0]);
}

export async function upsertOwnProfile(userId: string, input: WorkforceProfileInput): Promise<WorkforceProfile> {
  await ensureOccupationExists(input.occupationId);

  return withDbTransaction(async (client) => {
    const region = normalizeNullableText(input.region);
    const skillLevel = normalizeSkillLevel(input.skillLevel);
    const availabilityPreferences = normalizeJsonObject(input.availabilityPreferences ?? {});
    const workPreferences = normalizeJsonObject(input.workPreferences ?? {});

    await client.query(
      `
        INSERT INTO workforce_profiles (user_id, occupation_id, skill_level, region, recruited_state, recruited_resolved_at)
        VALUES ($1, $2::uuid, $3, $4, false, NULL)
        ON CONFLICT (user_id)
        DO UPDATE SET
          occupation_id = EXCLUDED.occupation_id,
          skill_level = EXCLUDED.skill_level,
          region = EXCLUDED.region,
          updated_at = NOW()
      `,
      [userId, input.occupationId, skillLevel, region],
    );

    await client.query(
      `
        INSERT INTO workforce_user_extension (user_id, availability_preferences, work_preferences, service_deleted_at)
        VALUES ($1, $2::jsonb, $3::jsonb, NULL)
        ON CONFLICT (user_id)
        DO UPDATE SET
          availability_preferences = EXCLUDED.availability_preferences,
          work_preferences = EXCLUDED.work_preferences,
          service_deleted_at = NULL,
          updated_at = NOW()
      `,
      [userId, JSON.stringify(availabilityPreferences), JSON.stringify(workPreferences)],
    );

    const refreshed = await client.query<WorkforceProfileRow>(
      `
        SELECT
          p.user_id,
          p.occupation_id,
          o.name AS occupation_name,
          p.skill_level,
          p.region,
          p.recruited_state,
          p.recruited_resolved_at,
          COALESCE(ue.availability_preferences, '{}'::jsonb) AS availability_preferences,
          COALESCE(ue.work_preferences, '{}'::jsonb) AS work_preferences,
          ue.service_deleted_at,
          GREATEST(p.updated_at, COALESCE(ue.updated_at, p.updated_at)) AS updated_at
        FROM workforce_profiles p
        LEFT JOIN workforce_user_extension ue ON ue.user_id = p.user_id
        LEFT JOIN workforce_occupations o ON o.id = p.occupation_id
        WHERE p.user_id = $1
        LIMIT 1
      `,
      [userId],
    );

    return mapWorkforceProfile(refreshed.rows[0]);
  });
}

export async function deleteOwnWorkforceProfile(userId: string): Promise<{ requestedAtIso: string }> {
  return withDbTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO workforce_user_extension (user_id, availability_preferences, work_preferences, service_deleted_at)
        VALUES ($1, '{}'::jsonb, '{}'::jsonb, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          availability_preferences = '{}'::jsonb,
          work_preferences = '{}'::jsonb,
          service_deleted_at = NOW(),
          updated_at = NOW()
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE workforce_profiles
        SET
          occupation_id = NULL,
          region = NULL,
          updated_at = NOW()
        WHERE user_id = $1
      `,
      [userId],
    );

    const result = await client.query<{ requested_at: Date }>(
      `
        INSERT INTO workforce_recruited_events
          (user_id, directory_profile_id, source_event, inference_dedupe_key, resolved_recruited, resolved_at, metadata)
        VALUES
          ($1, 'service-delete', 'workforce_profile_service_delete', $2, false, NOW(), '{"scope":"service"}'::jsonb)
        ON CONFLICT (inference_dedupe_key)
        DO UPDATE SET created_at = workforce_recruited_events.created_at
        RETURNING created_at AS requested_at
      `,
      [userId, createHash('sha256').update(`service-delete:${userId}`).digest('hex')],
    );

    return {
      requestedAtIso: toIso(result.rows[0].requested_at),
    };
  });
}

export async function listOccupations(
  pagination: { page: number; pageSize: number },
  includeInactive = false,
): Promise<{ items: WorkforceOccupation[]; pagination: WorkforcePagination }> {
  const offset = (pagination.page - 1) * pagination.pageSize;

  const [countResult, rows] = await Promise.all([
    queryDb<CountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM workforce_occupations
        WHERE ($1::boolean OR is_active = true)
      `,
      [includeInactive],
    ),
    queryDb<WorkforceOccupationRow>(
      `
        SELECT id, name, sector, is_active, created_by_user_id, updated_by_user_id, created_at, updated_at
        FROM workforce_occupations
        WHERE ($1::boolean OR is_active = true)
        ORDER BY updated_at DESC
        OFFSET $2 LIMIT $3
      `,
      [includeInactive, offset, pagination.pageSize],
    ),
  ]);

  return {
    items: rows.rows.map(mapOccupation),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: Number.parseInt(countResult.rows[0]?.total ?? '0', 10),
    },
  };
}

export async function getOccupationById(id: string): Promise<WorkforceOccupation | null> {
  const result = await queryDb<WorkforceOccupationRow>(
    `
      SELECT id, name, sector, is_active, created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM workforce_occupations
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapOccupation(result.rows[0]);
}

export async function createOccupation(actorId: string, input: WorkforceOccupationInput): Promise<WorkforceOccupation> {
  const result = await queryDb<WorkforceOccupationRow>(
    `
      INSERT INTO workforce_occupations (name, sector, is_active, created_by_user_id, updated_by_user_id)
      VALUES ($1, $2, COALESCE($3, true), $4, $4)
      RETURNING id, name, sector, is_active, created_by_user_id, updated_by_user_id, created_at, updated_at
    `,
    [normalizeText(input.name), normalizeNullableText(input.sector), input.isActive, actorId],
  );

  return mapOccupation(result.rows[0]);
}

export async function updateOccupation(
  actorId: string,
  id: string,
  input: WorkforceOccupationInput,
): Promise<WorkforceOccupation | null> {
  const result = await queryDb<WorkforceOccupationRow>(
    `
      UPDATE workforce_occupations
      SET
        name = $2,
        sector = $3,
        is_active = COALESCE($4, is_active),
        updated_by_user_id = $5,
        updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING id, name, sector, is_active, created_by_user_id, updated_by_user_id, created_at, updated_at
    `,
    [id, normalizeText(input.name), normalizeNullableText(input.sector), input.isActive, actorId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapOccupation(result.rows[0]);
}

export async function deleteOccupation(id: string): Promise<'deleted' | 'not_found'> {
  const result = await queryDb<{ id: string }>(
    'DELETE FROM workforce_occupations WHERE id = $1::uuid RETURNING id',
    [id],
  );

  return result.rows.length > 0 ? 'deleted' : 'not_found';
}

export async function listAnnouncements(publicOnly = true): Promise<WorkforceAnnouncement[]> {
  const result = await queryDb<WorkforceAnnouncementRow>(
    `
      SELECT id, title, body, is_active, published_at, expires_at, created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM workforce_announcements
      WHERE ($1::boolean = false OR (
        is_active = true
        AND published_at <= NOW()
        AND (expires_at IS NULL OR expires_at > NOW())
      ))
      ORDER BY published_at DESC, created_at DESC
    `,
    [publicOnly],
  );

  return result.rows.map(mapAnnouncement);
}

export async function createAnnouncement(actorId: string, input: WorkforceAnnouncementInput): Promise<WorkforceAnnouncement> {
  const result = await queryDb<WorkforceAnnouncementRow>(
    `
      INSERT INTO workforce_announcements
        (title, body, is_active, published_at, expires_at, created_by_user_id, updated_by_user_id)
      VALUES
        ($1, $2, COALESCE($3, true), NOW(), $4::timestamptz, $5, $5)
      RETURNING id, title, body, is_active, published_at, expires_at, created_by_user_id, updated_by_user_id, created_at, updated_at
    `,
    [normalizeText(input.title), normalizeText(input.body), input.isActive, input.expiresAtIso ?? null, actorId],
  );

  return mapAnnouncement(result.rows[0]);
}

export async function updateAnnouncement(
  actorId: string,
  id: string,
  input: WorkforceAnnouncementInput,
): Promise<WorkforceAnnouncement | null> {
  const result = await queryDb<WorkforceAnnouncementRow>(
    `
      UPDATE workforce_announcements
      SET
        title = $2,
        body = $3,
        is_active = COALESCE($4, is_active),
        expires_at = CASE WHEN $5::boolean THEN NULL ELSE COALESCE($6::timestamptz, expires_at) END,
        updated_by_user_id = $7,
        updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING id, title, body, is_active, published_at, expires_at, created_by_user_id, updated_by_user_id, created_at, updated_at
    `,
    [
      id,
      normalizeText(input.title),
      normalizeText(input.body),
      input.isActive,
      input.expiresAtIso === null,
      input.expiresAtIso ?? null,
      actorId,
    ],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapAnnouncement(result.rows[0]);
}

export async function deactivateAnnouncement(actorId: string, id: string): Promise<'deactivated' | 'not_found'> {
  const result = await queryDb<{ id: string }>(
    `
      UPDATE workforce_announcements
      SET is_active = false, updated_by_user_id = $2, updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING id
    `,
    [id, actorId],
  );

  return result.rows.length > 0 ? 'deactivated' : 'not_found';
}

export async function getWorkforceConfig(): Promise<WorkforceConfig> {
  const result = await queryDb<WorkforceConfigRow>(
    `
      SELECT exports_enabled, kill_switch_enabled, report_week_timezone, report_week_start_dow,
             updated_by_user_id, updated_at
      FROM workforce_config
      WHERE singleton_key = true
      LIMIT 1
    `,
  );

  const row = result.rows[0];
  if (!row) {
    return {
      exportsEnabled: false,
      killSwitchEnabled: false,
      reportWeekTimezone: WORKFORCE_DEFAULT_TIMEZONE,
      reportWeekStartDow: WORKFORCE_DEFAULT_WEEK_START_DOW,
      updatedByUserId: 'system',
      updatedAtIso: new Date(0).toISOString(),
    };
  }

  return mapConfig(row);
}

export async function updateWorkforceConfig(actorId: string, input: WorkforceConfigInput): Promise<WorkforceConfig> {
  const result = await queryDb<WorkforceConfigRow>(
    `
      INSERT INTO workforce_config
        (singleton_key, exports_enabled, kill_switch_enabled, report_week_timezone, report_week_start_dow, updated_by_user_id)
      VALUES
        (true, $1, $2, $3, $4, $5)
      ON CONFLICT (singleton_key)
      DO UPDATE SET
        exports_enabled = EXCLUDED.exports_enabled,
        kill_switch_enabled = EXCLUDED.kill_switch_enabled,
        report_week_timezone = EXCLUDED.report_week_timezone,
        report_week_start_dow = EXCLUDED.report_week_start_dow,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING exports_enabled, kill_switch_enabled, report_week_timezone, report_week_start_dow,
                updated_by_user_id, updated_at
    `,
    [input.exportsEnabled, input.killSwitchEnabled, normalizeText(input.reportWeekTimezone), input.reportWeekStartDow, actorId],
  );

  return mapConfig(result.rows[0]);
}

export async function fetchSummaryReport(): Promise<WorkforceSummaryReport> {
  // Live from Directory (see getDashboard): total = active profiles, recruited = claimed.
  const result = await queryDb<WorkforceReportRow>(
    `
      SELECT
        COUNT(*)::int AS workforce_total,
        COUNT(*) FILTER (WHERE claimed_by_user_id IS NOT NULL)::int AS recruited_total
      FROM directory_profiles
      WHERE is_active = TRUE AND deleted_at IS NULL
    `,
  );

  return {
    workforceTotal: result.rows[0]?.workforce_total ?? 0,
    recruitedTotal: result.rows[0]?.recruited_total ?? 0,
    generatedAtIso: new Date().toISOString(),
  };
}

export async function fetchSkillLevelReport(): Promise<WorkforceGroupedReportItem[]> {
  // Skill level is not a field on the source of truth (directory_profiles), so there is no
  // honest live breakdown to show. Return empty; the shell hides the skill-distribution panel
  // when there are no items. (Retired with the workforce_profiles copy — see change log.)
  return [];
}

export async function fetchSectorReport(): Promise<WorkforceGroupedReportItem[]> {
  // Group the active directory profiles by their Skills Taxonomy sector; recruited = claimed.
  const result = await queryDb<WorkforceGroupedRow>(
    `
      SELECT
        COALESCE(s.name, 'Unassigned') AS bucket,
        COUNT(*)::text AS workforce_total,
        COUNT(*) FILTER (WHERE dp.claimed_by_user_id IS NOT NULL)::text AS recruited_total
      FROM directory_profiles dp
      LEFT JOIN skills_taxonomy_sectors s ON s.id = dp.sector_id
      WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL
      GROUP BY COALESCE(s.name, 'Unassigned')
      ORDER BY bucket ASC
    `,
  );

  return result.rows.map((row) => ({
    bucket: row.bucket,
    workforceTotal: Number.parseInt(row.workforce_total, 10),
    recruitedTotal: Number.parseInt(row.recruited_total, 10),
  }));
}

export async function runIncrementalRecruitedSync(
  actorId: string | null,
  options?: { batchSize?: number; source?: string },
): Promise<{ processedProfiles: number; insertedEvents: number; cursorAtIso: string }> {
  return withDbTransaction(async (client) => {
    const source = options?.source ?? 'incremental_sync';
    const batchSize = Math.min(Math.max(options?.batchSize ?? 500, 1), 2000);

    await client.query(
      `
        INSERT INTO workforce_recruited_sync_cursor (singleton_key, last_cursor_at)
        VALUES (TRUE, '1970-01-01T00:00:00Z'::timestamptz)
        ON CONFLICT (singleton_key)
        DO NOTHING
      `,
    );

    const cursorResult = await client.query<WorkforceSyncCursorRow>(
      `
        SELECT last_cursor_at
        FROM workforce_recruited_sync_cursor
        WHERE singleton_key = TRUE
        FOR UPDATE
      `,
    );

    const cursorAt = cursorResult.rows[0]?.last_cursor_at ?? new Date('1970-01-01T00:00:00Z');

    const changedProfiles = await client.query<WorkforceDirectoryDeltaRow>(
      `
        SELECT id, claimed_by_user_id, updated_at
        FROM directory_profiles
        WHERE updated_at > $1
        ORDER BY updated_at ASC, id ASC
        LIMIT $2
      `,
      [cursorAt, batchSize],
    );

    let insertedEvents = 0;

    for (const profile of changedProfiles.rows) {
      const currentClaimedUserId = profile.claimed_by_user_id;

      if (currentClaimedUserId) {
        const dedupeKey = createHash('sha256')
          .update(`${profile.id}:${currentClaimedUserId}:claimed:${profile.updated_at.toISOString()}`)
          .digest('hex');

        const insertClaimEvent = await client.query<{ id: string }>(
          `
            INSERT INTO workforce_recruited_events
              (user_id, directory_profile_id, source_event, inference_dedupe_key, resolved_recruited, resolved_at, metadata)
            VALUES
              ($1, $2, 'directory_profile_upsert', $3, true, NOW(), jsonb_build_object('source', $4, 'mode', 'incremental'))
            ON CONFLICT (inference_dedupe_key)
            DO NOTHING
            RETURNING id
          `,
          [currentClaimedUserId, profile.id, dedupeKey, source],
        );

        if (insertClaimEvent.rows.length > 0) {
          insertedEvents += 1;
        }

        await client.query(
          `
            INSERT INTO workforce_profiles (user_id, recruited_state, recruited_resolved_at)
            VALUES ($1, true, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
              recruited_state = true,
              recruited_resolved_at = NOW(),
              updated_at = NOW()
          `,
          [currentClaimedUserId],
        );
      }

      const priorLinkedUsers = await client.query<{ user_id: string }>(
        `
          SELECT DISTINCT user_id
          FROM workforce_recruited_events
          WHERE directory_profile_id = $1
            AND user_id IS NOT NULL
            AND ($2::text IS NULL OR user_id <> $2::text)
        `,
        [profile.id, currentClaimedUserId],
      );

      for (const linkedUser of priorLinkedUsers.rows) {
        const unclaimDedupeKey = createHash('sha256')
          .update(`${profile.id}:${linkedUser.user_id}:unclaimed:${profile.updated_at.toISOString()}`)
          .digest('hex');

        const insertUnclaimEvent = await client.query<{ id: string }>(
          `
            INSERT INTO workforce_recruited_events
              (user_id, directory_profile_id, source_event, inference_dedupe_key, resolved_recruited, resolved_at, metadata)
            VALUES
              ($1, $2, 'directory_profile_upsert', $3, false, NOW(), jsonb_build_object('source', $4, 'mode', 'incremental'))
            ON CONFLICT (inference_dedupe_key)
            DO NOTHING
            RETURNING id
          `,
          [linkedUser.user_id, profile.id, unclaimDedupeKey, source],
        );

        if (insertUnclaimEvent.rows.length > 0) {
          insertedEvents += 1;
        }

        await client.query(
          `
            INSERT INTO workforce_profiles (user_id, recruited_state, recruited_resolved_at)
            VALUES ($1, false, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
              recruited_state = false,
              recruited_resolved_at = NOW(),
              updated_at = NOW()
          `,
          [linkedUser.user_id],
        );
      }
    }

    const lastProcessedAt = changedProfiles.rows.length > 0
      ? changedProfiles.rows[changedProfiles.rows.length - 1].updated_at
      : cursorAt;

    await client.query(
      `
        UPDATE workforce_recruited_sync_cursor
        SET
          last_cursor_at = $1,
          updated_at = NOW()
        WHERE singleton_key = TRUE
      `,
      [lastProcessedAt],
    );

    if (actorId) {
      await client.query(
        `
          INSERT INTO workforce_admin_audit_trail
            (actor_id, command, policy_status, reason, target_type, target_id, metadata)
          VALUES
            ($1, 'workforce.recruited.sync.incremental', 'allow', 'admin_route_guard', 'sync', 'workforce',
             jsonb_build_object('source', $2, 'processedProfiles', $3::int, 'insertedEvents', $4::int, 'batchSize', $5::int))
        `,
        [actorId, source, changedProfiles.rows.length, insertedEvents, batchSize],
      );
    }

    return {
      processedProfiles: changedProfiles.rows.length,
      insertedEvents,
      cursorAtIso: lastProcessedAt.toISOString(),
    };
  });
}

export async function enqueueRecruitedRecompute(actorId: string): Promise<{ insertedEvents: number }> {
  return withDbTransaction(async (client) => {
    const directoryProfiles = await client.query<{ id: string; claimed_by_user_id: string; updated_at: Date }>(
      `
        SELECT id, claimed_by_user_id, updated_at
        FROM directory_profiles
        WHERE claimed_by_user_id IS NOT NULL
      `,
    );

    let insertedEvents = 0;

    for (const row of directoryProfiles.rows) {
      const dedupeKey = createHash('sha256')
        .update(`${row.id}:${row.claimed_by_user_id}:${row.updated_at.toISOString()}`)
        .digest('hex');

      const insertEvent = await client.query<{ id: string }>(
        `
          INSERT INTO workforce_recruited_events
            (user_id, directory_profile_id, source_event, inference_dedupe_key, resolved_recruited, resolved_at, metadata)
          VALUES
            ($1, $2, 'directory_profile_upsert', $3, true, NOW(), jsonb_build_object('source', 'admin_recompute'))
          ON CONFLICT (inference_dedupe_key)
          DO NOTHING
          RETURNING id
        `,
        [row.claimed_by_user_id, row.id, dedupeKey],
      );

      if (insertEvent.rows.length > 0) {
        insertedEvents += 1;
      }

      await client.query(
        `
          INSERT INTO workforce_profiles (user_id, recruited_state, recruited_resolved_at)
          VALUES ($1, true, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            recruited_state = true,
            recruited_resolved_at = NOW(),
            updated_at = NOW()
        `,
        [row.claimed_by_user_id],
      );
    }

    await client.query(
      `
        INSERT INTO workforce_admin_audit_trail
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES
          ($1, 'workforce.admin.recompute.enqueue', 'allow', 'admin_route_guard', 'recompute', 'workforce',
           jsonb_build_object('insertedEvents', $2::int))
      `,
      [actorId, insertedEvents],
    );

    return { insertedEvents };
  });
}

export async function insertWorkforceAdminAudit(input: {
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
      INSERT INTO workforce_admin_audit_trail
        (actor_id, command, policy_status, reason, target_type, target_id, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      input.actorId,
      input.command,
      input.policyStatus,
      input.reason,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function listAdminAuditEvents(
  pagination: { page: number; pageSize: number },
): Promise<{
  items: Array<{
    id: string;
    actorId: string;
    command: string;
    policyStatus: 'allow' | 'deny';
    reason: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAtIso: string;
  }>;
  pagination: WorkforcePagination;
}> {
  const offset = (pagination.page - 1) * pagination.pageSize;

  const [countResult, rows] = await Promise.all([
    queryDb<CountRow>('SELECT COUNT(*)::text AS total FROM workforce_admin_audit_trail'),
    queryDb<WorkforceAuditRow>(
      `
        SELECT id, actor_id, command, policy_status, reason, target_type, target_id, metadata, created_at
        FROM workforce_admin_audit_trail
        ORDER BY created_at DESC
        OFFSET $1 LIMIT $2
      `,
      [offset, pagination.pageSize],
    ),
  ]);

  return {
    items: rows.rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      command: row.command,
      policyStatus: row.policy_status,
      reason: row.reason,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: normalizeJsonObject(row.metadata),
      createdAtIso: toIso(row.created_at),
    })),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: Number.parseInt(countResult.rows[0]?.total ?? '0', 10),
    },
  };
}

export async function createDeferredExportJob(actorId: string, exportType: string): Promise<WorkforceExportJob> {
  const result = await queryDb<{
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'deferred';
    export_type: string;
    created_by_user_id: string;
    created_at: Date;
    completed_at: Date | null;
  }>(
    `
      INSERT INTO workforce_export_jobs (status, export_type, created_by_user_id, completed_at)
      VALUES ('deferred', $1, $2, NOW())
      RETURNING id, status, export_type, created_by_user_id, created_at, completed_at
    `,
    [exportType, actorId],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    status: row.status,
    exportType: row.export_type,
    createdByUserId: row.created_by_user_id,
    createdAtIso: toIso(row.created_at),
    completedAtIso: row.completed_at ? toIso(row.completed_at) : null,
  };
}

export async function getExportJobById(jobId: string): Promise<WorkforceExportJob | null> {
  const result = await queryDb<{
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'deferred';
    export_type: string;
    created_by_user_id: string;
    created_at: Date;
    completed_at: Date | null;
  }>(
    `
      SELECT id, status, export_type, created_by_user_id, created_at, completed_at
      FROM workforce_export_jobs
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [jobId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    status: row.status,
    exportType: row.export_type,
    createdByUserId: row.created_by_user_id,
    createdAtIso: toIso(row.created_at),
    completedAtIso: row.completed_at ? toIso(row.completed_at) : null,
  };
}
