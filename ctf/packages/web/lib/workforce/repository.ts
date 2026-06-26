import { queryDb } from 'lib/db/postgres';
import {
  WORKFORCE_SKILL_LEVELS,
  deriveWorkforceSkillLevel,
  type WorkforceSkillLevel,
} from './skill-level';
import {
  WORKFORCE_DEFAULT_MAX_RECRUITABLE,
  WORKFORCE_DEFAULT_MIN_RECRUITABLE,
  WORKFORCE_DEFAULT_PAGE,
  WORKFORCE_DEFAULT_PAGE_SIZE,
  WORKFORCE_DEFAULT_PARTICIPATION_RATE,
  WORKFORCE_DEFAULT_POPULATION,
  WORKFORCE_MAX_PAGE_SIZE,
} from './constants';
import type {
  WorkforceConfig,
  WorkforceConfigInput,
  WorkforceDashboard,
  WorkforceGroupedReportItem,
  WorkforceOccupation,
  WorkforceOccupationGapItem,
  WorkforcePagination,
  WorkforceProfile,
  WorkforceSummaryReport,
} from './types';

type CountRow = { total: string };

type WorkforceConfigRow = {
  population: string;
  participation_rate: string;
  min_recruitable: string;
  max_recruitable: string;
  updated_by_user_id: string;
  updated_at: Date;
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

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toFiniteNumber(value: string | null | undefined, fallback: number): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapConfig(row: WorkforceConfigRow): WorkforceConfig {
  return {
    population: Math.round(toFiniteNumber(row.population, WORKFORCE_DEFAULT_POPULATION)),
    participationRate: toFiniteNumber(row.participation_rate, WORKFORCE_DEFAULT_PARTICIPATION_RATE),
    minRecruitable: Math.round(toFiniteNumber(row.min_recruitable, WORKFORCE_DEFAULT_MIN_RECRUITABLE)),
    maxRecruitable: Math.round(toFiniteNumber(row.max_recruitable, WORKFORCE_DEFAULT_MAX_RECRUITABLE)),
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

export function validateConfigInput(input: WorkforceConfigInput): boolean {
  return Number.isFinite(input.population)
    && input.population > 0
    && Number.isFinite(input.participationRate)
    && input.participationRate >= 0
    && input.participationRate <= 1
    && Number.isFinite(input.minRecruitable)
    && input.minRecruitable >= 0
    && Number.isFinite(input.maxRecruitable)
    && input.maxRecruitable >= 0
    && input.maxRecruitable >= input.minRecruitable;
}

// ---------------------------------------------------------------------------
// Live workforce model
//
// The whole tracker is a read-only overlay of two upstream sources plus the workforce config:
//   - Skills Taxonomy (sectors + their workforce_share, and job titles) gives the DEMAND.
//   - Directory (active profiles, claimed = recruited) gives the SUPPLY.
//   - The workforce config gives the population scale.
// Nothing in Directory or Skills Taxonomy is ever written. We compute every view from one read so
// the dashboard, sector breakdown, skill-level breakdown, and occupation gaps are always consistent.
// ---------------------------------------------------------------------------

type SectorModelRow = { id: string; name: string; workforce_share: string | null };
type JobTitleModelRow = { id: string; sector_id: string; name: string };
type MemberModelRow = {
  sector_id: string | null;
  job_title_id: string | null;
  job_title_name: string | null;
  claimed: boolean;
};

const UNASSIGNED_BUCKET = 'Unassigned';

export type WorkforceModel = {
  config: WorkforceConfig;
  workforceTotal: number;
  totalHeadcountTarget: number;
  totalMembers: number;
  recruitedTotal: number;
  sectorsTotal: number;
  occupationsTotal: number;
  sectors: WorkforceGroupedReportItem[];
  skillLevels: WorkforceGroupedReportItem[];
  occupations: WorkforceOccupationGapItem[];
  generatedAtIso: string;
};

function emptyBucket(): { members: number; recruited: number } {
  return { members: 0, recruited: 0 };
}

export async function computeWorkforceModel(): Promise<WorkforceModel> {
  const config = await getWorkforceConfig();
  const workforceTotal = Math.max(0, Math.round(config.population * config.participationRate));

  const [sectorsRes, jobTitlesRes, membersRes] = await Promise.all([
    queryDb<SectorModelRow>(
      `SELECT id::text AS id, name, workforce_share::text AS workforce_share
       FROM skills_taxonomy_sectors
       WHERE is_active = TRUE
       ORDER BY display_order ASC, name ASC`,
    ),
    queryDb<JobTitleModelRow>(
      `SELECT id::text AS id, sector_id::text AS sector_id, name
       FROM skills_taxonomy_job_titles
       WHERE is_active = TRUE
       ORDER BY display_order ASC, name ASC`,
    ),
    queryDb<MemberModelRow>(
      `SELECT
         COALESCE(jt.sector_id, dp.sector_id)::text AS sector_id,
         dp.job_title_id::text AS job_title_id,
         jt.name AS job_title_name,
         (dp.claimed_by_user_id IS NOT NULL) AS claimed
       FROM directory_profiles dp
       LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = dp.job_title_id
       WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL`,
    ),
  ]);

  const sectors = sectorsRes.rows;
  const jobTitles = jobTitlesRes.rows;
  const members = membersRes.rows;

  // Demand: distribute the workforce total across sectors by each sector's workforce share. Shares
  // are normalized so they always sum to the workforce total even if the raw shares don't sum to 1.
  // If no sector carries a positive share, fall back to an even split so the breakdown is never blank.
  const shareById = new Map<string, number>();
  let shareSum = 0;
  for (const s of sectors) {
    const share = Math.max(0, toFiniteNumber(s.workforce_share, 0));
    shareById.set(s.id, share);
    shareSum += share;
  }
  const evenWeight = sectors.length > 0 ? 1 / sectors.length : 0;
  const sectorDemand = new Map<string, number>();
  for (const s of sectors) {
    const weight = shareSum > 0 ? (shareById.get(s.id) ?? 0) / shareSum : evenWeight;
    sectorDemand.set(s.id, Math.round(weight * workforceTotal));
  }

  // Per-occupation demand: split a sector's demand evenly across its active job titles.
  const jobTitlesBySector = new Map<string, JobTitleModelRow[]>();
  for (const jt of jobTitles) {
    const list = jobTitlesBySector.get(jt.sector_id) ?? [];
    list.push(jt);
    jobTitlesBySector.set(jt.sector_id, list);
  }
  const jobTitleDemand = new Map<string, number>();
  for (const [sectorId, list] of jobTitlesBySector) {
    const demand = sectorDemand.get(sectorId) ?? 0;
    const per = list.length > 0 ? Math.round(demand / list.length) : 0;
    for (const jt of list) {
      jobTitleDemand.set(jt.id, per);
    }
  }

  // Supply: count Directory members and the claimed (recruited) subset per sector, per occupation,
  // and per skill level.
  const membersBySector = new Map<string, { members: number; recruited: number }>();
  const membersByJobTitle = new Map<string, { members: number; recruited: number }>();
  const membersBySkillLevel = new Map<WorkforceSkillLevel, { members: number; recruited: number }>();
  for (const level of WORKFORCE_SKILL_LEVELS) {
    membersBySkillLevel.set(level, emptyBucket());
  }
  let totalMembers = 0;
  let recruitedTotal = 0;

  for (const m of members) {
    totalMembers += 1;
    if (m.claimed) {
      recruitedTotal += 1;
    }

    const sectorKey = m.sector_id ?? UNASSIGNED_BUCKET;
    const sectorBucket = membersBySector.get(sectorKey) ?? emptyBucket();
    sectorBucket.members += 1;
    if (m.claimed) sectorBucket.recruited += 1;
    membersBySector.set(sectorKey, sectorBucket);

    if (m.job_title_id) {
      const jtBucket = membersByJobTitle.get(m.job_title_id) ?? emptyBucket();
      jtBucket.members += 1;
      if (m.claimed) jtBucket.recruited += 1;
      membersByJobTitle.set(m.job_title_id, jtBucket);
    }

    const level = deriveWorkforceSkillLevel(m.job_title_name);
    const levelBucket = membersBySkillLevel.get(level)!;
    levelBucket.members += 1;
    if (m.claimed) levelBucket.recruited += 1;
  }

  // Sector breakdown: every active sector (so the view is never blank), plus an Unassigned row when
  // Directory members have no resolvable sector.
  const sectorItems: WorkforceGroupedReportItem[] = sectors.map((s) => {
    const supply = membersBySector.get(s.id) ?? emptyBucket();
    const target = sectorDemand.get(s.id) ?? 0;
    return {
      bucket: s.name,
      target,
      members: supply.members,
      recruited: supply.recruited,
      gap: Math.max(0, target - supply.recruited),
    };
  });
  const unassigned = membersBySector.get(UNASSIGNED_BUCKET);
  if (unassigned && (unassigned.members > 0 || unassigned.recruited > 0)) {
    sectorItems.push({
      bucket: UNASSIGNED_BUCKET,
      target: 0,
      members: unassigned.members,
      recruited: unassigned.recruited,
      gap: 0,
    });
  }

  // Skill-level breakdown: roll each occupation's demand up by the level derived from its job-title
  // name (the V2 keyword rule), and pair it with the live supply at that level.
  const demandBySkillLevel = new Map<WorkforceSkillLevel, number>();
  for (const level of WORKFORCE_SKILL_LEVELS) {
    demandBySkillLevel.set(level, 0);
  }
  for (const jt of jobTitles) {
    const level = deriveWorkforceSkillLevel(jt.name);
    demandBySkillLevel.set(level, (demandBySkillLevel.get(level) ?? 0) + (jobTitleDemand.get(jt.id) ?? 0));
  }
  const skillLevelItems: WorkforceGroupedReportItem[] = WORKFORCE_SKILL_LEVELS.map((level) => {
    const supply = membersBySkillLevel.get(level)!;
    const target = demandBySkillLevel.get(level) ?? 0;
    return {
      bucket: level,
      target,
      members: supply.members,
      recruited: supply.recruited,
      gap: Math.max(0, target - supply.recruited),
    };
  }).filter((item) => item.target > 0 || item.members > 0);

  // Per-occupation training gaps (sorted largest gap first) — the LevelUp recruiting/training signal.
  const sectorNameById = new Map(sectors.map((s) => [s.id, s.name]));
  const occupationItems: WorkforceOccupationGapItem[] = jobTitles.map((jt) => {
    const supply = membersByJobTitle.get(jt.id) ?? emptyBucket();
    const target = jobTitleDemand.get(jt.id) ?? 0;
    return {
      jobTitleId: jt.id,
      occupation: jt.name,
      sector: sectorNameById.get(jt.sector_id) ?? UNASSIGNED_BUCKET,
      skillLevel: deriveWorkforceSkillLevel(jt.name),
      target,
      members: supply.members,
      recruited: supply.recruited,
      gap: Math.max(0, target - supply.recruited),
    };
  });
  occupationItems.sort((a, b) => b.gap - a.gap || a.occupation.localeCompare(b.occupation));

  const totalHeadcountTarget = Array.from(sectorDemand.values()).reduce((sum, n) => sum + n, 0);

  return {
    config,
    workforceTotal,
    totalHeadcountTarget,
    totalMembers,
    recruitedTotal,
    sectorsTotal: sectors.length,
    occupationsTotal: jobTitles.length,
    sectors: sectorItems,
    skillLevels: skillLevelItems,
    occupations: occupationItems,
    generatedAtIso: new Date().toISOString(),
  };
}

function percentRecruited(recruited: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.round(((recruited / target) * 100 + Number.EPSILON) * 100) / 100;
}

export async function getDashboard(): Promise<WorkforceDashboard> {
  const model = await computeWorkforceModel();
  return {
    population: model.config.population,
    participationRate: model.config.participationRate,
    workforceTotal: model.workforceTotal,
    totalHeadcountTarget: model.totalHeadcountTarget,
    totalMembers: model.totalMembers,
    recruitedTotal: model.recruitedTotal,
    percentRecruited: percentRecruited(model.recruitedTotal, model.totalHeadcountTarget),
    remainingCapacity: Math.max(0, model.config.maxRecruitable - model.recruitedTotal),
    minRecruitable: model.config.minRecruitable,
    maxRecruitable: model.config.maxRecruitable,
    sectorsTotal: model.sectorsTotal,
    occupationsTotal: model.occupationsTotal,
    generatedAtIso: model.generatedAtIso,
  };
}

export async function fetchSummaryReport(): Promise<WorkforceSummaryReport> {
  const model = await computeWorkforceModel();
  return {
    population: model.config.population,
    workforceTotal: model.workforceTotal,
    totalHeadcountTarget: model.totalHeadcountTarget,
    totalMembers: model.totalMembers,
    recruitedTotal: model.recruitedTotal,
    percentRecruited: percentRecruited(model.recruitedTotal, model.totalHeadcountTarget),
    generatedAtIso: model.generatedAtIso,
  };
}

export async function fetchSectorReport(): Promise<WorkforceGroupedReportItem[]> {
  const model = await computeWorkforceModel();
  return model.sectors;
}

export async function fetchSkillLevelReport(): Promise<WorkforceGroupedReportItem[]> {
  const model = await computeWorkforceModel();
  return model.skillLevels;
}

export async function fetchOccupationGapReport(): Promise<WorkforceOccupationGapItem[]> {
  const model = await computeWorkforceModel();
  return model.occupations;
}

// Occupations browse is a read-only, paginated view of Skills Taxonomy job titles with their
// demand/supply overlay. Sorted by largest gap first so the biggest needs surface to the top.
export async function listOccupations(
  pagination: { page: number; pageSize: number },
): Promise<{ items: WorkforceOccupation[]; pagination: WorkforcePagination }> {
  const model = await computeWorkforceModel();
  const all = model.occupations;
  const offset = (pagination.page - 1) * pagination.pageSize;
  const items = all.slice(offset, offset + pagination.pageSize).map((occ) => ({
    id: occ.jobTitleId,
    name: occ.occupation,
    sector: occ.sector,
    skillLevel: occ.skillLevel,
    target: occ.target,
    members: occ.members,
    recruited: occ.recruited,
    gap: occ.gap,
  }));

  return {
    items,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: all.length,
    },
  };
}

export async function getOccupationById(id: string): Promise<WorkforceOccupation | null> {
  const model = await computeWorkforceModel();
  const occ = model.occupations.find((o) => o.jobTitleId === id);
  if (!occ) {
    return null;
  }
  return {
    id: occ.jobTitleId,
    name: occ.occupation,
    sector: occ.sector,
    skillLevel: occ.skillLevel,
    target: occ.target,
    members: occ.members,
    recruited: occ.recruited,
    gap: occ.gap,
  };
}

// ---------------------------------------------------------------------------
// Own profile (read-only Directory-derived view + workforce-owned extension)
// ---------------------------------------------------------------------------

type WorkforceExtensionRow = {
  availability_preferences: Record<string, unknown> | null;
  work_preferences: Record<string, unknown> | null;
  service_deleted_at: Date | null;
  updated_at: Date;
};

async function getOwnExtension(userId: string): Promise<WorkforceExtensionRow | null> {
  const result = await queryDb<WorkforceExtensionRow>(
    `
      SELECT availability_preferences, work_preferences, service_deleted_at, updated_at
      FROM workforce_user_extension
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function getOwnProfile(userId: string): Promise<WorkforceProfile | null> {
  // The occupation/skill view is a live read of the member's own claimed Directory profile
  // (occupation = their Skills Taxonomy job title; skill level is derived from it; recruited = true,
  // since a claimed profile is by definition a recruited member). The editable extension fields
  // (availability/work preferences) and the plugin-scoped deletion marker live in
  // workforce_user_extension — the only table the profile flow writes, and it is workforce-owned.
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

  const extension = await getOwnExtension(userId);

  return {
    userId,
    occupationId: row.job_title_id,
    occupationName: row.job_title_name,
    skillLevel: deriveWorkforceSkillLevel(row.job_title_name),
    region: null,
    recruitedState: true,
    recruitedResolvedAtIso: null,
    availabilityPreferences: normalizeJsonObject(extension?.availability_preferences),
    workPreferences: normalizeJsonObject(extension?.work_preferences),
    serviceDeletedAtIso: extension?.service_deleted_at ? toIso(extension.service_deleted_at) : null,
    updatedAtIso: toIso(row.updated_at),
  };
}

// Service-scoped soft delete (deletion contract section 5): set service_deleted_at = NOW() and reset
// both preference payloads to empty objects on workforce_user_extension (a workforce-owned table —
// Directory and Skills Taxonomy are never touched). Returns false when the caller has no claimed
// Directory profile (nothing to delete).
export async function softDeleteOwnProfile(userId: string): Promise<boolean> {
  const profile = await getOwnProfile(userId);
  if (!profile) {
    return false;
  }

  await queryDb(
    `
      INSERT INTO workforce_user_extension
        (user_id, availability_preferences, work_preferences, service_deleted_at, updated_at)
      VALUES ($1, '{}'::jsonb, '{}'::jsonb, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        availability_preferences = '{}'::jsonb,
        work_preferences = '{}'::jsonb,
        service_deleted_at = NOW(),
        updated_at = NOW()
    `,
    [userId],
  );

  return true;
}

export async function insertWorkforceDeletionEvent(input: {
  userId: string;
  scope: string;
  result: string;
  requestId: string | null;
  traceId: string | null;
  processedAt?: Date | null;
}): Promise<void> {
  await queryDb(
    `
      INSERT INTO workforce_deletion_events
        (user_id, scope, plugin_id, requested_at, processed_at, result, request_id, trace_id)
      VALUES ($1, $2, 'workforce', NOW(), $3, $4, $5, $6)
    `,
    [
      input.userId,
      input.scope,
      input.processedAt ?? new Date(),
      input.result,
      input.requestId,
      input.traceId,
    ],
  );
}

// ---------------------------------------------------------------------------
// Workforce config (workforce-owned, admin-editable)
// ---------------------------------------------------------------------------

export async function getWorkforceConfig(): Promise<WorkforceConfig> {
  const result = await queryDb<WorkforceConfigRow>(
    `
      SELECT population::text, participation_rate::text, min_recruitable::text, max_recruitable::text,
             updated_by_user_id, updated_at
      FROM workforce_config
      WHERE singleton_key = true
      LIMIT 1
    `,
  );

  const row = result.rows[0];
  if (!row) {
    return {
      population: WORKFORCE_DEFAULT_POPULATION,
      participationRate: WORKFORCE_DEFAULT_PARTICIPATION_RATE,
      minRecruitable: WORKFORCE_DEFAULT_MIN_RECRUITABLE,
      maxRecruitable: WORKFORCE_DEFAULT_MAX_RECRUITABLE,
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
        (singleton_key, population, participation_rate, min_recruitable, max_recruitable, updated_by_user_id)
      VALUES
        (true, $1, $2, $3, $4, $5)
      ON CONFLICT (singleton_key)
      DO UPDATE SET
        population = EXCLUDED.population,
        participation_rate = EXCLUDED.participation_rate,
        min_recruitable = EXCLUDED.min_recruitable,
        max_recruitable = EXCLUDED.max_recruitable,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING population::text, participation_rate::text, min_recruitable::text, max_recruitable::text,
                updated_by_user_id, updated_at
    `,
    [
      Math.round(input.population),
      input.participationRate,
      Math.round(input.minRecruitable),
      Math.round(input.maxRecruitable),
      actorId,
    ],
  );

  return mapConfig(result.rows[0]);
}

// ---------------------------------------------------------------------------
// Admin audit trail (workforce-owned)
// ---------------------------------------------------------------------------

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
