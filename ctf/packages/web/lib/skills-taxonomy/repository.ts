import type { PoolClient } from 'pg';
import {
  queryDb,
  withDbTransaction,
} from 'lib/db/postgres';

import type {
  TaxonomyDependencyImpact,
  TaxonomyDependencyTargetType,
  TaxonomyFlattenedItem,
  TaxonomyHierarchyJobTitle,
  TaxonomyHierarchySector,
  TaxonomyHierarchySkill,
  TaxonomyJobTitle,
  TaxonomySector,
  TaxonomySkill,
} from './types';

type SectorRow = {
  id: string;
  name: string;
  display_order: number;
  workforce_share: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type JobTitleRow = {
  id: string;
  sector_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type SkillRow = {
  id: string;
  job_title_id: string;
  name: string;
  display_order: number;
  aliases: unknown;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type FlattenedRow = {
  sector_id: string;
  sector_name: string;
  job_title_id: string;
  job_title_name: string;
  skill_id: string;
  skill_name: string;
  skill_aliases: unknown;
  is_active: boolean;
};

type DependencyInternalRow = {
  child_job_titles: string;
  child_skills: string;
};

type DependencyExternalRow = {
  known_bindings: string;
};

export type SectorCreateInput = {
  name: string;
  displayOrder?: number;
  workforceShare?: number | null;
};

export type SectorUpdateInput = {
  id: string;
  name?: string;
  displayOrder?: number;
  workforceShare?: number | null;
  isActive?: boolean;
};

export type JobTitleCreateInput = {
  sectorId: string;
  name: string;
  displayOrder?: number;
};

export type JobTitleUpdateInput = {
  id: string;
  sectorId?: string;
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
};

export type SkillCreateInput = {
  jobTitleId: string;
  name: string;
  displayOrder?: number;
  aliases?: string[];
};

export type SkillUpdateInput = {
  id: string;
  jobTitleId?: string;
  name?: string;
  displayOrder?: number;
  aliases?: string[];
  isActive?: boolean;
};

function toNumberOrNull(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAliases(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

function mapSector(row: SectorRow): TaxonomySector {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    workforceShare: toNumberOrNull(row.workforce_share),
    isActive: row.is_active,
    createdAtIso: row.created_at.toISOString(),
    updatedAtIso: row.updated_at.toISOString(),
  };
}

function mapJobTitle(row: JobTitleRow): TaxonomyJobTitle {
  return {
    id: row.id,
    sectorId: row.sector_id,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAtIso: row.created_at.toISOString(),
    updatedAtIso: row.updated_at.toISOString(),
  };
}

function mapSkill(row: SkillRow): TaxonomySkill {
  return {
    id: row.id,
    jobTitleId: row.job_title_id,
    name: row.name,
    displayOrder: row.display_order,
    aliases: parseAliases(row.aliases),
    isActive: row.is_active,
    createdAtIso: row.created_at.toISOString(),
    updatedAtIso: row.updated_at.toISOString(),
  };
}

export function validateDependencyPreviewInput(targetType: string, targetId: string): targetType is TaxonomyDependencyTargetType {
  if (!targetId || targetId.trim().length === 0) {
    return false;
  }

  return targetType === 'sector' || targetType === 'job-title' || targetType === 'skill';
}

async function previewDependencyImpactWithClient(
  client: PoolClient,
  targetType: TaxonomyDependencyTargetType,
  targetId: string,
): Promise<TaxonomyDependencyImpact> {
  await ensureDependencyTargetExists(client, targetType, targetId);

  const { childJobTitles, childSkills } = await fetchInternalDependencyCounts(client, targetType, targetId);
  const knownBindings = await fetchExternalKnownBindings(client, targetType, targetId);
  const denyReasons = buildDependencyDenyReasons(childJobTitles, childSkills, knownBindings);

  return {
    targetType,
    targetId,
    reasonRequired: true,
    internal: {
      childJobTitles,
      childSkills,
    },
    external: {
      knownBindings,
      pending: true,
    },
    canDelete: denyReasons.length === 0,
    denyReasons,
  };
}

async function ensureDependencyTargetExists(
  client: PoolClient,
  targetType: TaxonomyDependencyTargetType,
  targetId: string,
): Promise<void> {
  if (targetType === 'sector') {
    await ensureSectorExists(client, targetId);
    return;
  }

  if (targetType === 'job-title') {
    await ensureJobTitleExists(client, targetId);
    return;
  }

  await ensureSkillExists(client, targetId);
}

async function fetchInternalDependencyCounts(
  client: PoolClient,
  targetType: TaxonomyDependencyTargetType,
  targetId: string,
): Promise<{ childJobTitles: number; childSkills: number }> {
  const internalResult = await client.query<DependencyInternalRow>(
    `
      SELECT
        CASE
          WHEN $1::text = 'sector'
            THEN (
              SELECT COUNT(*)::text FROM skills_taxonomy_job_titles jt WHERE jt.sector_id = $2
            )
          WHEN $1::text = 'job-title'
            THEN '0'
          ELSE '0'
        END AS child_job_titles,
        CASE
          WHEN $1::text = 'sector'
            THEN (
              SELECT COUNT(*)::text
              FROM skills_taxonomy_skills sk
              JOIN skills_taxonomy_job_titles jt ON jt.id = sk.job_title_id
              WHERE jt.sector_id = $2
            )
          WHEN $1::text = 'job-title'
            THEN (
              SELECT COUNT(*)::text FROM skills_taxonomy_skills sk WHERE sk.job_title_id = $2
            )
          ELSE '0'
        END AS child_skills
    `,
    [targetType, targetId],
  );

  return {
    childJobTitles: Number.parseInt(internalResult.rows[0]?.child_job_titles ?? '0', 10),
    childSkills: Number.parseInt(internalResult.rows[0]?.child_skills ?? '0', 10),
  };
}

async function fetchExternalKnownBindings(
  client: PoolClient,
  targetType: TaxonomyDependencyTargetType,
  targetId: string,
): Promise<number> {
  const externalResult = await client.query<DependencyExternalRow>(
    `
      SELECT COALESCE(SUM(reference_count), 0)::text AS known_bindings
      FROM skills_taxonomy_consumer_bindings
      WHERE target_type = $1 AND target_id = $2
    `,
    [targetType, targetId],
  );

  return Number.parseInt(externalResult.rows[0]?.known_bindings ?? '0', 10);
}

function buildDependencyDenyReasons(
  childJobTitles: number,
  childSkills: number,
  knownBindings: number,
): string[] {
  const denyReasons: string[] = [];
  if (childJobTitles > 0 || childSkills > 0) {
    denyReasons.push('unresolved_downstream_dependencies');
  }
  if (knownBindings > 0) {
    denyReasons.push('destructive_threshold_exceeded');
  }

  return denyReasons;
}

async function ensureSectorExists(client: PoolClient, sectorId: string): Promise<void> {
  const result = await client.query<{ id: string }>('SELECT id FROM skills_taxonomy_sectors WHERE id = $1', [sectorId]);
  if (result.rows.length === 0) {
    throw new Error('sector_not_found');
  }
}

async function ensureJobTitleExists(client: PoolClient, jobTitleId: string): Promise<void> {
  const result = await client.query<{ id: string }>('SELECT id FROM skills_taxonomy_job_titles WHERE id = $1', [jobTitleId]);
  if (result.rows.length === 0) {
    throw new Error('job_title_not_found');
  }
}

async function ensureSkillExists(client: PoolClient, skillId: string): Promise<void> {
  const result = await client.query<{ id: string }>('SELECT id FROM skills_taxonomy_skills WHERE id = $1', [skillId]);
  if (result.rows.length === 0) {
    throw new Error('skill_not_found');
  }
}

export type TaxonomySummary = {
  sectors: number;
  jobTitles: number;
  skills: number;
};

// Live aggregate counts of the active taxonomy (sectors / job titles / skills) for the signed-out
// splash teaser. Returns ONLY counts — no taxonomy rows and no member data — so it is safe to serve
// without auth, unlike the gated /hierarchy read. The counts are read straight from the tables, so
// adding a sector / job title / skill is reflected on the next load with no extra wiring.
export async function getTaxonomySummary(): Promise<TaxonomySummary> {
  const result = await queryDb<{ sectors: string; job_titles: string; skills: string }>(
    `
      SELECT
        (SELECT COUNT(*) FROM skills_taxonomy_sectors WHERE is_active = true)::text AS sectors,
        (SELECT COUNT(*) FROM skills_taxonomy_job_titles WHERE is_active = true)::text AS job_titles,
        (SELECT COUNT(*) FROM skills_taxonomy_skills WHERE is_active = true)::text AS skills
    `,
  );
  const row = result.rows[0];
  return {
    sectors: Number.parseInt(row?.sectors ?? '0', 10) || 0,
    jobTitles: Number.parseInt(row?.job_titles ?? '0', 10) || 0,
    skills: Number.parseInt(row?.skills ?? '0', 10) || 0,
  };
}

export async function listSectors(includeInactive = true): Promise<TaxonomySector[]> {
  const result = await queryDb<SectorRow>(
    `
      SELECT id, name, display_order, workforce_share::text, is_active, created_at, updated_at
      FROM skills_taxonomy_sectors
      WHERE ($1::boolean OR is_active = true)
      ORDER BY display_order ASC, name ASC
    `,
    [includeInactive],
  );

  return result.rows.map(mapSector);
}

export async function getSectorById(id: string): Promise<TaxonomySector | null> {
  const result = await queryDb<SectorRow>(
    `
      SELECT id, name, display_order, workforce_share::text, is_active, created_at, updated_at
      FROM skills_taxonomy_sectors
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ? mapSector(result.rows[0]) : null;
}

export async function listJobTitles(includeInactive = true): Promise<TaxonomyJobTitle[]> {
  const result = await queryDb<JobTitleRow>(
    `
      SELECT id, sector_id, name, display_order, is_active, created_at, updated_at
      FROM skills_taxonomy_job_titles
      WHERE ($1::boolean OR is_active = true)
      ORDER BY display_order ASC, name ASC
    `,
    [includeInactive],
  );

  return result.rows.map(mapJobTitle);
}

export async function getJobTitleById(id: string): Promise<TaxonomyJobTitle | null> {
  const result = await queryDb<JobTitleRow>(
    `
      SELECT id, sector_id, name, display_order, is_active, created_at, updated_at
      FROM skills_taxonomy_job_titles
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ? mapJobTitle(result.rows[0]) : null;
}

export async function listSkills(includeInactive = true): Promise<TaxonomySkill[]> {
  const result = await queryDb<SkillRow>(
    `
      SELECT id, job_title_id, name, display_order, aliases, is_active, created_at, updated_at
      FROM skills_taxonomy_skills
      WHERE ($1::boolean OR is_active = true)
      ORDER BY display_order ASC, name ASC
    `,
    [includeInactive],
  );

  return result.rows.map(mapSkill);
}

export async function getSkillById(id: string): Promise<TaxonomySkill | null> {
  const result = await queryDb<SkillRow>(
    `
      SELECT id, job_title_id, name, display_order, aliases, is_active, created_at, updated_at
      FROM skills_taxonomy_skills
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ? mapSkill(result.rows[0]) : null;
}

function mapHierarchySkill(row: SkillRow): TaxonomyHierarchySkill {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    aliases: parseAliases(row.aliases),
    isActive: row.is_active,
  };
}

function mapHierarchyJobTitle(row: JobTitleRow): TaxonomyHierarchyJobTitle {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active,
    skills: [],
  };
}

function mapHierarchySector(row: SectorRow): TaxonomyHierarchySector {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    workforceShare: toNumberOrNull(row.workforce_share),
    isActive: row.is_active,
    jobTitles: [],
  };
}

export async function getHierarchy(includeInactive = false): Promise<TaxonomyHierarchySector[]> {
  return withDbTransaction(async (client) => {
    const sectorsResult = await client.query<SectorRow>(
      `
        SELECT id, name, display_order, workforce_share::text, is_active, created_at, updated_at
        FROM skills_taxonomy_sectors
        WHERE ($1::boolean OR is_active = true)
        ORDER BY display_order ASC, name ASC
      `,
      [includeInactive],
    );

    const jobTitlesResult = await client.query<JobTitleRow>(
      `
        SELECT id, sector_id, name, display_order, is_active, created_at, updated_at
        FROM skills_taxonomy_job_titles
        WHERE ($1::boolean OR is_active = true)
        ORDER BY display_order ASC, name ASC
      `,
      [includeInactive],
    );

    const skillsResult = await client.query<SkillRow>(
      `
        SELECT id, job_title_id, name, display_order, aliases, is_active, created_at, updated_at
        FROM skills_taxonomy_skills
        WHERE ($1::boolean OR is_active = true)
        ORDER BY display_order ASC, name ASC
      `,
      [includeInactive],
    );

    const sectorsById = new Map<string, TaxonomyHierarchySector>();
    const jobTitlesById = new Map<string, TaxonomyHierarchyJobTitle>();

    for (const sectorRow of sectorsResult.rows) {
      const sector = mapHierarchySector(sectorRow);
      sectorsById.set(sector.id, sector);
    }

    for (const jobTitleRow of jobTitlesResult.rows) {
      const jobTitle = mapHierarchyJobTitle(jobTitleRow);
      jobTitlesById.set(jobTitle.id, jobTitle);
      sectorsById.get(jobTitleRow.sector_id)?.jobTitles.push(jobTitle);
    }

    for (const skillRow of skillsResult.rows) {
      const skill = mapHierarchySkill(skillRow);
      jobTitlesById.get(skillRow.job_title_id)?.skills.push(skill);
    }

    return Array.from(sectorsById.values());
  });
}

export async function getFlattened(includeInactive = false, includeAliases = false): Promise<TaxonomyFlattenedItem[]> {
  // Read the live base tables (skills -> job titles -> sectors) rather than the
  // skills_taxonomy_flattened_projection table. That projection is never populated by any
  // code path, so reading it returned an empty list even when the taxonomy is fully seeded —
  // which left the SkillsHunt nomination picker with no categories (free-text only). Joining
  // the base tables gives the same flat shape and always reflects the current taxonomy.
  const result = await queryDb<FlattenedRow>(
    `
      SELECT
        sec.id AS sector_id,
        sec.name AS sector_name,
        jt.id AS job_title_id,
        jt.name AS job_title_name,
        sk.id AS skill_id,
        sk.name AS skill_name,
        sk.aliases AS skill_aliases,
        (sk.is_active AND jt.is_active AND sec.is_active) AS is_active
      FROM skills_taxonomy_skills sk
      JOIN skills_taxonomy_job_titles jt ON jt.id = sk.job_title_id
      JOIN skills_taxonomy_sectors sec ON sec.id = jt.sector_id
      WHERE ($1::boolean OR (sk.is_active AND jt.is_active AND sec.is_active))
      ORDER BY sec.name ASC, jt.name ASC, sk.name ASC
    `,
    [includeInactive],
  );

  return result.rows.map((row) => ({
    sectorId: row.sector_id,
    sectorName: row.sector_name,
    jobTitleId: row.job_title_id,
    jobTitleName: row.job_title_name,
    skillId: row.skill_id,
    skillName: row.skill_name,
    aliases: includeAliases ? parseAliases(row.skill_aliases) : [],
    isActive: row.is_active,
  }));
}

export async function previewDependencyImpact(
  targetType: TaxonomyDependencyTargetType,
  targetId: string,
): Promise<TaxonomyDependencyImpact> {
  return withDbTransaction((client) => previewDependencyImpactWithClient(client, targetType, targetId));
}
