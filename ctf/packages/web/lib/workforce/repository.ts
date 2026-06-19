import { queryDb } from 'lib/db/postgres';
import {
  WORKFORCE_SKILL_LEVELS,
  deriveWorkforceSkillLevel,
  type WorkforceSkillLevel,
} from './skill-level';
import {
  WORKFORCE_DEFAULT_PAGE,
  WORKFORCE_DEFAULT_PAGE_SIZE,
  WORKFORCE_DEFAULT_TIMEZONE,
  WORKFORCE_DEFAULT_WEEK_START_DOW,
  WORKFORCE_MAX_OCCUPATION_NAME_LENGTH,
  WORKFORCE_MAX_PAGE_SIZE,
} from './constants';
import type {
  WorkforceConfig,
  WorkforceConfigInput,
  WorkforceDashboard,
  WorkforceExportJob,
  WorkforceGroupedReportItem,
  WorkforceOccupation,
  WorkforceOccupationInput,
  WorkforcePagination,
  WorkforceProfile,
  WorkforceSummaryReport,
} from './types';

type CountRow = { total: string };

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

type WorkforceConfigRow = {
  exports_enabled: boolean;
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

function mapConfig(row: WorkforceConfigRow): WorkforceConfig {
  return {
    exportsEnabled: row.exports_enabled,
    reportWeekTimezone: row.report_week_timezone,
    reportWeekStartDow: row.report_week_start_dow,
    updatedByUserId: row.updated_by_user_id,
    updatedAtIso: toIso(row.updated_at),
  };
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

export function validateOccupationInput(input: WorkforceOccupationInput): boolean {
  const name = normalizeText(input.name ?? '');
  const sector = normalizeNullableText(input.sector);

  return name.length > 0
    && name.length <= WORKFORCE_MAX_OCCUPATION_NAME_LENGTH
    && (!sector || sector.length <= 80)
    && (input.isActive === undefined || typeof input.isActive === 'boolean');
}

export function validateConfigInput(input: WorkforceConfigInput): boolean {
  const timezone = normalizeText(input.reportWeekTimezone ?? '');

  return typeof input.exportsEnabled === 'boolean'
    && timezone.length > 0
    && timezone.length <= 64
    && Number.isInteger(input.reportWeekStartDow)
    && input.reportWeekStartDow >= 0
    && input.reportWeekStartDow <= 6;
}

export async function getDashboard(): Promise<WorkforceDashboard> {
  // Directory (+ Skills Taxonomy) is the single source of truth: the workforce population IS the
  // active directory profiles, and "recruited" means a profile that has been claimed by a user.
  // We read directory_profiles live rather than keeping a synced workforce_profiles copy, so the
  // numbers can never drift and there is no sync job to fail.
  const [workforceCount, recruitedCount, occupationCount] = await Promise.all([
    queryDb<CountRow>("SELECT COUNT(*)::text AS total FROM directory_profiles WHERE is_active = TRUE AND deleted_at IS NULL"),
    queryDb<CountRow>("SELECT COUNT(*)::text AS total FROM directory_profiles WHERE is_active = TRUE AND deleted_at IS NULL AND claimed_by_user_id IS NOT NULL"),
    queryDb<CountRow>('SELECT COUNT(*)::text AS total FROM workforce_occupations WHERE is_active = true'),
  ]);

  return {
    workforceTotal: Number.parseInt(workforceCount.rows[0]?.total ?? '0', 10),
    recruitedTotal: Number.parseInt(recruitedCount.rows[0]?.total ?? '0', 10),
    occupationsTotal: Number.parseInt(occupationCount.rows[0]?.total ?? '0', 10),
    generatedAtIso: new Date().toISOString(),
  };
}

export async function getOwnProfile(userId: string): Promise<WorkforceProfile | null> {
  // Read-only: a member's workforce profile is a live view of their own claimed Directory profile.
  // Occupation = their Skills Taxonomy job title; skill level is derived from it; recruited = true
  // (a claimed profile is, by definition, a recruited member). Workforce no longer stores or edits
  // its own profile rows — Directory + Skills Taxonomy are the single source of truth.
  const result = await queryDb<{ job_title_id: string | null; job_title_name: string | null; updated_at: Date }>(
    `
      SELECT dp.job_title_id::text AS job_title_id, jt.name AS job_title_name, dp.updated_at
      FROM directory_profiles dp
      LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = dp.job_title_id
      WHERE dp.claimed_by_user_id = $1 AND dp.is_active = TRUE AND dp.deleted_at IS NULL
      ORDER BY dp.updated_at DESC
      LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    userId,
    occupationId: row.job_title_id,
    occupationName: row.job_title_name,
    skillLevel: deriveWorkforceSkillLevel(row.job_title_name),
    region: null,
    recruitedState: true,
    recruitedResolvedAtIso: null,
    availabilityPreferences: {},
    workPreferences: {},
    serviceDeletedAtIso: null,
    updatedAtIso: toIso(row.updated_at),
  };
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

export async function getWorkforceConfig(): Promise<WorkforceConfig> {
  const result = await queryDb<WorkforceConfigRow>(
    `
      SELECT exports_enabled, report_week_timezone, report_week_start_dow,
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
        (singleton_key, exports_enabled, report_week_timezone, report_week_start_dow, updated_by_user_id)
      VALUES
        (true, $1, $2, $3, $4)
      ON CONFLICT (singleton_key)
      DO UPDATE SET
        exports_enabled = EXCLUDED.exports_enabled,
        report_week_timezone = EXCLUDED.report_week_timezone,
        report_week_start_dow = EXCLUDED.report_week_start_dow,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING exports_enabled, report_week_timezone, report_week_start_dow,
                updated_by_user_id, updated_at
    `,
    [input.exportsEnabled, normalizeText(input.reportWeekTimezone), input.reportWeekStartDow, actorId],
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
  // Skill level is derived live from each active directory profile's Skills Taxonomy job-title
  // name, using V2's keyword rule (see lib/workforce/skill-level.ts) — Foundational / Intermediate
  // / Advanced. No stored column, no seed; the breakdown lives on the source of truth. Recruited =
  // claimed. Aggregated in code over the (small) active-profile set so the keyword lists stay in
  // one place, shared with the drill-down.
  const result = await queryDb<{ job_title_name: string | null; claimed: boolean }>(
    `
      SELECT jt.name AS job_title_name, (dp.claimed_by_user_id IS NOT NULL) AS claimed
      FROM directory_profiles dp
      LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = dp.job_title_id
      WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL
    `,
  );

  const buckets = new Map<WorkforceSkillLevel, { workforceTotal: number; recruitedTotal: number }>();
  for (const level of WORKFORCE_SKILL_LEVELS) {
    buckets.set(level, { workforceTotal: 0, recruitedTotal: 0 });
  }
  for (const row of result.rows) {
    const bucket = buckets.get(deriveWorkforceSkillLevel(row.job_title_name))!;
    bucket.workforceTotal += 1;
    if (row.claimed) {
      bucket.recruitedTotal += 1;
    }
  }

  // Foundational → Intermediate → Advanced; include only levels that have people so the shell's
  // panel shows the buckets that actually exist.
  return WORKFORCE_SKILL_LEVELS
    .map((level) => ({ bucket: level, ...buckets.get(level)! }))
    .filter((item) => item.workforceTotal > 0);
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
