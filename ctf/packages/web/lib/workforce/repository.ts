import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import {
  WORKFORCE_SKILL_LEVELS,
  deriveAnnualTrainingTarget,
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
  profile_id: string;
  job_title_sector_id: string | null;
  profile_sector_id: string | null;
  job_title_id: string | null;
  job_title_name: string | null;
  claimed: boolean;
};
// One row per (profile, job title reachable through one of the profile's skills). Used for the
// skill arm of the V2 aspirational match: a profile counts toward an occupation if it carries a
// skill registered under that occupation's job title.
type ProfileSkillJobTitleRow = { profile_id: string; job_title_id: string };

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

// The web shell loads the dashboard, sector, skill-level, and occupation reports in one page load —
// four routes that each call computeWorkforceModel(), i.e. four identical full recomputations (~16 DB
// queries) for the same global, user-independent data. Coalesce them: an in-flight computation is
// shared by concurrent callers, and the result is reused for a brief TTL so a burst of requests in one
// load runs the model once.
//
// The model has NO per-user/per-workspace input — it is the same global workforce aggregate for every
// caller (the product is single-tenant; see lib/auth/server-authz AllowDecision, which carries no
// workspaceId). So a process-global cache is correct here. If the product ever becomes multi-tenant,
// this cache must be keyed per workspace. To avoid serving stale numbers right after an admin edits
// the config, updateWorkforceConfig() calls invalidateWorkforceModelCache().
const WORKFORCE_MODEL_CACHE_MS = 1000;
let workforceModelInFlight: Promise<WorkforceModel> | null = null;
let workforceModelCache: { at: number; value: WorkforceModel } | null = null;

export function invalidateWorkforceModelCache(): void {
  workforceModelCache = null;
}

export async function computeWorkforceModel(): Promise<WorkforceModel> {
  if (workforceModelCache && Date.now() - workforceModelCache.at < WORKFORCE_MODEL_CACHE_MS) {
    return workforceModelCache.value;
  }
  if (workforceModelInFlight) {
    return workforceModelInFlight;
  }
  workforceModelInFlight = computeWorkforceModelUncached()
    .then((value) => {
      workforceModelCache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      workforceModelInFlight = null;
    });
  return workforceModelInFlight;
}

// Sector demand distribution — shared by the full model and the lightweight dashboard summary so the
// dashboard's totalHeadcountTarget can never diverge from the sector reports' implied total. Shares are
// normalized so they always sum to the workforce total even if the raw shares don't sum to 1. If no
// sector carries a positive share, fall back to an even split so the breakdown is never blank.
function buildSectorDemand(sectors: SectorModelRow[], workforceTotal: number): Map<string, number> {
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
  return sectorDemand;
}

// The three global inputs of the model plus the optional skill arm, loaded together. The skill arm
// is loaded separately and defensively: skills match by NAME, not by row (owner decision
// 2026-07-04): a profile counts toward EVERY occupation that lists an active skill with the same
// normalized name as one the profile holds. A skill is a capability, not a pointer to the one
// occupation whose copy the member happened to pick — row-based matching funneled every holder of a
// shared skill into a single sector. The `held` join is the member's own skill row; `other` is every
// active same-named row across the taxonomy. If this optional query fails on a given database,
// recruited degrades to the sector and job-title arms rather than failing the whole read-only
// dashboard with a 503.
async function fetchWorkforceModelInputs(): Promise<{
  sectors: SectorModelRow[];
  jobTitles: JobTitleModelRow[];
  members: MemberModelRow[];
  profileSkillRows: ProfileSkillJobTitleRow[];
}> {
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
         dp.id::text AS profile_id,
         jt.sector_id::text AS job_title_sector_id,
         dp.sector_id::text AS profile_sector_id,
         dp.job_title_id::text AS job_title_id,
         jt.name AS job_title_name,
         (dp.claimed_by_user_id IS NOT NULL) AS claimed
       FROM directory_profiles dp
       LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = dp.job_title_id
       WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL`,
    ),
  ]);

  let profileSkillRows: ProfileSkillJobTitleRow[] = [];
  try {
    const profileSkillsRes = await queryDb<ProfileSkillJobTitleRow>(
      `SELECT DISTINCT dps.profile_id::text AS profile_id, other.job_title_id::text AS job_title_id
       FROM directory_profile_skills dps
       JOIN skills_taxonomy_skills held ON held.id = dps.skill_id AND held.is_active = TRUE
       JOIN skills_taxonomy_skills other
         ON lower(btrim(other.name)) = lower(btrim(held.name)) AND other.is_active = TRUE`,
    );
    profileSkillRows = profileSkillsRes.rows;
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'computeWorkforceModel_skillArm' });
  }

  return {
    sectors: sectorsRes.rows,
    jobTitles: jobTitlesRes.rows,
    members: membersRes.rows,
    profileSkillRows,
  };
}

// Group the active job titles by their sector so a sector's demand can be split across them.
function groupJobTitlesBySector(jobTitles: JobTitleModelRow[]): Map<string, JobTitleModelRow[]> {
  const jobTitlesBySector = new Map<string, JobTitleModelRow[]>();
  for (const jt of jobTitles) {
    const list = jobTitlesBySector.get(jt.sector_id) ?? [];
    list.push(jt);
    jobTitlesBySector.set(jt.sector_id, list);
  }
  return jobTitlesBySector;
}

// Per-occupation demand: split a sector's demand evenly across its active job titles.
function buildJobTitleDemand(
  jobTitlesBySector: Map<string, JobTitleModelRow[]>,
  sectorDemand: Map<string, number>,
): Map<string, number> {
  const jobTitleDemand = new Map<string, number>();
  for (const [sectorId, list] of jobTitlesBySector) {
    const demand = sectorDemand.get(sectorId) ?? 0;
    const per = list.length > 0 ? Math.round(demand / list.length) : 0;
    for (const jt of list) {
      jobTitleDemand.set(jt.id, per);
    }
  }
  return jobTitleDemand;
}

// Per profile, the set of job titles reachable through one of its skills (the skill arm).
function buildSkillJobTitlesByProfile(
  profileSkillRows: ProfileSkillJobTitleRow[],
  jobTitleById: Map<string, JobTitleModelRow>,
): Map<string, Set<string>> {
  const skillJobTitlesByProfile = new Map<string, Set<string>>();
  for (const r of profileSkillRows) {
    if (!jobTitleById.has(r.job_title_id)) continue;
    let set = skillJobTitlesByProfile.get(r.profile_id);
    if (!set) {
      set = new Set<string>();
      skillJobTitlesByProfile.set(r.profile_id, set);
    }
    set.add(r.job_title_id);
  }
  return skillJobTitlesByProfile;
}

// From a sector -> count tally, pick the sector holding the most of a profile's skills, breaking
// ties by sector name for determinism.
function pickBestSector(tally: Map<string, number>, sectorNames: Map<string, string>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [sectorId, count] of tally) {
    if (
      count > bestCount
      || (count === bestCount && best !== null
        && (sectorNames.get(sectorId) ?? '') < (sectorNames.get(best) ?? ''))
    ) {
      best = sectorId;
      bestCount = count;
    }
  }
  return best;
}

// Sector each profile's skills map to through the taxonomy. Every skill is mapped to an
// occupation and a sector by spec, so a member's picked skills always resolve to a sector: the
// one holding the most of their skills (ties broken by sector name for determinism).
function buildSkillDerivedSectorByProfile(
  skillJobTitlesByProfile: Map<string, Set<string>>,
  jobTitleById: Map<string, JobTitleModelRow>,
  sectors: SectorModelRow[],
): Map<string, string> {
  const sectorNameForTieBreak = new Map(sectors.map((s) => [s.id, s.name] as const));
  const skillDerivedSectorByProfile = new Map<string, string>();
  for (const [profileId, jobTitleIds] of skillJobTitlesByProfile) {
    const tally = new Map<string, number>();
    for (const jobTitleId of jobTitleIds) {
      const sectorId = jobTitleById.get(jobTitleId)?.sector_id;
      if (!sectorId) continue;
      tally.set(sectorId, (tally.get(sectorId) ?? 0) + 1);
    }
    const best = pickBestSector(tally, sectorNameForTieBreak);
    if (best) {
      skillDerivedSectorByProfile.set(profileId, best);
    }
  }
  return skillDerivedSectorByProfile;
}

// A fresh skill-level -> 0 count map, every level present.
function newSkillLevelCountMap(): Map<WorkforceSkillLevel, number> {
  const map = new Map<WorkforceSkillLevel, number>();
  for (const level of WORKFORCE_SKILL_LEVELS) {
    map.set(level, 0);
  }
  return map;
}

// A fresh skill-level -> empty set map, every level present.
function newSkillLevelSetMap(): Map<WorkforceSkillLevel, Set<string>> {
  const map = new Map<WorkforceSkillLevel, Set<string>>();
  for (const level of WORKFORCE_SKILL_LEVELS) {
    map.set(level, new Set<string>());
  }
  return map;
}

// Increment a numeric count keyed by `key`, treating a missing key as 0.
function bump<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

// Add a profile id to the set at `key`, creating the set on first use.
function addProfileToBucket(map: Map<string, Set<string>>, key: string, profileId: string): void {
  let set = map.get(key);
  if (!set) {
    set = new Set<string>();
    map.set(key, set);
  }
  set.add(profileId);
}

// The member's own sector, by spec precedence: taxonomy-derived signals first — the chosen
// occupation maps to a sector, and the chosen skills map to occupations and sectors — then the
// raw profile sector field (a label with no taxonomy mapping behind it). Only a member with no
// occupation, no skills, and no sector lands in the Unassigned bucket.
function resolveMemberSectorId(
  m: MemberModelRow,
  skillDerivedSectorByProfile: Map<string, string>,
): string | null {
  return m.job_title_sector_id
    ?? skillDerivedSectorByProfile.get(m.profile_id)
    ?? m.profile_sector_id
    ?? null;
}

// Matched job titles: the profile's own job title plus its skill-derived job titles.
function buildMatchedJobTitles(
  m: MemberModelRow,
  jobTitleById: Map<string, JobTitleModelRow>,
  skillJobTitlesByProfile: Map<string, Set<string>>,
): Set<string> {
  const matchedJobTitles = new Set<string>();
  if (m.job_title_id && jobTitleById.has(m.job_title_id)) {
    matchedJobTitles.add(m.job_title_id);
  }
  const skillMatched = skillJobTitlesByProfile.get(m.profile_id);
  if (skillMatched) {
    for (const id of skillMatched) matchedJobTitles.add(id);
  }
  return matchedJobTitles;
}

// Matched occupations: the matched job titles PLUS every occupation in the profile's own sector
// (V2's sector arm makes a profile count for all occupations in its sector).
function buildMatchedOccupations(
  matchedJobTitles: Set<string>,
  resolvedSectorId: string | null,
  jobTitlesBySector: Map<string, JobTitleModelRow[]>,
): Set<string> {
  const matchedOccupations = new Set<string>(matchedJobTitles);
  if (resolvedSectorId) {
    for (const jt of jobTitlesBySector.get(resolvedSectorId) ?? []) {
      matchedOccupations.add(jt.id);
    }
  }
  return matchedOccupations;
}

// Matched sectors: the profile's own sector plus the sectors of every matched job title.
function buildMatchedSectors(
  matchedJobTitles: Set<string>,
  resolvedSectorId: string | null,
  jobTitleById: Map<string, JobTitleModelRow>,
): Set<string> {
  const matchedSectors = new Set<string>();
  if (resolvedSectorId) matchedSectors.add(resolvedSectorId);
  for (const id of matchedJobTitles) {
    const jt = jobTitleById.get(id);
    if (jt) matchedSectors.add(jt.sector_id);
  }
  return matchedSectors;
}

// Skill levels covered by a member's matched occupations, derived from each job-title name.
function buildMatchedLevels(
  matchedOccupations: Set<string>,
  jobTitleById: Map<string, JobTitleModelRow>,
): Set<WorkforceSkillLevel> {
  const matchedLevels = new Set<WorkforceSkillLevel>();
  for (const jobTitleId of matchedOccupations) {
    const jt = jobTitleById.get(jobTitleId);
    if (jt) matchedLevels.add(deriveWorkforceSkillLevel(jt.name));
  }
  return matchedLevels;
}

// The per-bucket member counts and DISTINCT recruited profile sets built from the member rows.
type WorkforceBuckets = {
  totalMembers: number;
  memberCountBySector: Map<string, number>;
  memberCountByJobTitle: Map<string, number>;
  memberCountBySkillLevel: Map<WorkforceSkillLevel, number>;
  recruitedBySector: Map<string, Set<string>>;
  recruitedByJobTitle: Map<string, Set<string>>;
  recruitedBySkillLevel: Map<WorkforceSkillLevel, Set<string>>;
};

// Supply (V2 aspirational match). "members" is the physical count of profiles whose resolved
// sector / job title falls in a bucket. "recruited" is the DISTINCT Directory profiles that MATCH a
// bucket by ANY of three signals — same sector, same job title, or a skill registered under the job
// title — counted live (not just claimed profiles). A profile's own sector expands to every
// occupation in that sector, so per-occupation recruited is intentionally generous; this mirrors V2.
function accumulateMemberBuckets(input: {
  members: MemberModelRow[];
  jobTitleById: Map<string, JobTitleModelRow>;
  jobTitlesBySector: Map<string, JobTitleModelRow[]>;
  skillJobTitlesByProfile: Map<string, Set<string>>;
  skillDerivedSectorByProfile: Map<string, string>;
}): WorkforceBuckets {
  const { members, jobTitleById, jobTitlesBySector, skillJobTitlesByProfile, skillDerivedSectorByProfile } = input;

  const memberCountBySector = new Map<string, number>();
  const memberCountByJobTitle = new Map<string, number>();
  const memberCountBySkillLevel = newSkillLevelCountMap();
  const recruitedBySector = new Map<string, Set<string>>();
  const recruitedByJobTitle = new Map<string, Set<string>>();
  const recruitedBySkillLevel = newSkillLevelSetMap();
  let totalMembers = 0;

  for (const m of members) {
    totalMembers += 1;

    const resolvedSectorId = resolveMemberSectorId(m, skillDerivedSectorByProfile);
    const sectorKey = resolvedSectorId ?? UNASSIGNED_BUCKET;
    bump(memberCountBySector, sectorKey);
    if (m.job_title_id) {
      bump(memberCountByJobTitle, m.job_title_id);
    }
    bump(memberCountBySkillLevel, deriveWorkforceSkillLevel(m.job_title_name));

    const matchedJobTitles = buildMatchedJobTitles(m, jobTitleById, skillJobTitlesByProfile);
    const matchedOccupations = buildMatchedOccupations(matchedJobTitles, resolvedSectorId, jobTitlesBySector);
    const matchedSectors = buildMatchedSectors(matchedJobTitles, resolvedSectorId, jobTitleById);

    for (const sectorId of matchedSectors) addProfileToBucket(recruitedBySector, sectorId, m.profile_id);
    for (const jobTitleId of matchedOccupations) addProfileToBucket(recruitedByJobTitle, jobTitleId, m.profile_id);
    for (const level of buildMatchedLevels(matchedOccupations, jobTitleById)) {
      recruitedBySkillLevel.get(level)!.add(m.profile_id);
    }
  }

  return {
    totalMembers,
    memberCountBySector,
    memberCountByJobTitle,
    memberCountBySkillLevel,
    recruitedBySector,
    recruitedByJobTitle,
    recruitedBySkillLevel,
  };
}

// Sector breakdown: every active sector (so the view is never blank), plus an Unassigned row when
// Directory members have no resolvable sector.
function buildSectorItems(
  sectors: SectorModelRow[],
  sectorDemand: Map<string, number>,
  buckets: WorkforceBuckets,
): WorkforceGroupedReportItem[] {
  const sectorItems: WorkforceGroupedReportItem[] = sectors.map((s) => {
    const target = sectorDemand.get(s.id) ?? 0;
    const recruited = buckets.recruitedBySector.get(s.id)?.size ?? 0;
    return {
      bucket: s.name,
      target,
      members: buckets.memberCountBySector.get(s.id) ?? 0,
      recruited,
      gap: Math.max(0, target - recruited),
    };
  });
  const unassignedMembers = buckets.memberCountBySector.get(UNASSIGNED_BUCKET) ?? 0;
  const unassignedRecruited = buckets.recruitedBySector.get(UNASSIGNED_BUCKET)?.size ?? 0;
  if (unassignedMembers > 0 || unassignedRecruited > 0) {
    sectorItems.push({
      bucket: UNASSIGNED_BUCKET,
      target: 0,
      members: unassignedMembers,
      recruited: unassignedRecruited,
      gap: 0,
    });
  }
  return sectorItems;
}

// Skill-level breakdown: roll each occupation's demand up by the level derived from its job-title
// name (the V2 keyword rule), and pair it with the live matched supply at that level.
function buildSkillLevelItems(
  jobTitles: JobTitleModelRow[],
  jobTitleDemand: Map<string, number>,
  buckets: WorkforceBuckets,
): WorkforceGroupedReportItem[] {
  const demandBySkillLevel = newSkillLevelCountMap();
  for (const jt of jobTitles) {
    const level = deriveWorkforceSkillLevel(jt.name);
    demandBySkillLevel.set(level, (demandBySkillLevel.get(level) ?? 0) + (jobTitleDemand.get(jt.id) ?? 0));
  }
  return WORKFORCE_SKILL_LEVELS.map((level) => {
    const target = demandBySkillLevel.get(level) ?? 0;
    const recruited = buckets.recruitedBySkillLevel.get(level)?.size ?? 0;
    return {
      bucket: level,
      target,
      members: buckets.memberCountBySkillLevel.get(level) ?? 0,
      recruited,
      gap: Math.max(0, target - recruited),
    };
  }).filter((item) => item.target > 0 || item.members > 0);
}

// Per-occupation training gaps (sorted largest gap first) — the LevelUp recruiting/training signal.
function buildOccupationItems(
  jobTitles: JobTitleModelRow[],
  jobTitleDemand: Map<string, number>,
  sectors: SectorModelRow[],
  buckets: WorkforceBuckets,
): WorkforceOccupationGapItem[] {
  const sectorNameById = new Map(sectors.map((s) => [s.id, s.name]));
  const occupationItems: WorkforceOccupationGapItem[] = jobTitles.map((jt) => {
    const target = jobTitleDemand.get(jt.id) ?? 0;
    const recruited = buckets.recruitedByJobTitle.get(jt.id)?.size ?? 0;
    return {
      jobTitleId: jt.id,
      occupation: jt.name,
      sector: sectorNameById.get(jt.sector_id) ?? UNASSIGNED_BUCKET,
      skillLevel: deriveWorkforceSkillLevel(jt.name),
      target,
      members: buckets.memberCountByJobTitle.get(jt.id) ?? 0,
      recruited,
      gap: Math.max(0, target - recruited),
    };
  });
  occupationItems.sort((a, b) => b.gap - a.gap || a.occupation.localeCompare(b.occupation));
  return occupationItems;
}

async function computeWorkforceModelUncached(): Promise<WorkforceModel> {
  const config = await getWorkforceConfig();
  const workforceTotal = Math.max(0, Math.round(config.population * config.participationRate));

  const { sectors, jobTitles, members, profileSkillRows } = await fetchWorkforceModelInputs();

  // Demand: distribute the workforce total across sectors by each sector's workforce share (shared with
  // the lightweight dashboard summary so the two can never disagree on the headcount target).
  const sectorDemand = buildSectorDemand(sectors, workforceTotal);
  const jobTitlesBySector = groupJobTitlesBySector(jobTitles);
  const jobTitleDemand = buildJobTitleDemand(jobTitlesBySector, sectorDemand);

  const jobTitleById = new Map(jobTitles.map((jt) => [jt.id, jt] as const));
  const skillJobTitlesByProfile = buildSkillJobTitlesByProfile(profileSkillRows, jobTitleById);
  const skillDerivedSectorByProfile = buildSkillDerivedSectorByProfile(
    skillJobTitlesByProfile,
    jobTitleById,
    sectors,
  );

  const buckets = accumulateMemberBuckets({
    members,
    jobTitleById,
    jobTitlesBySector,
    skillJobTitlesByProfile,
    skillDerivedSectorByProfile,
  });

  // Top-line recruited mirrors V2 exactly: the count of ALL active Directory profiles.
  const recruitedTotal = buckets.totalMembers;

  const sectorItems = buildSectorItems(sectors, sectorDemand, buckets);
  const skillLevelItems = buildSkillLevelItems(jobTitles, jobTitleDemand, buckets);
  const occupationItems = buildOccupationItems(jobTitles, jobTitleDemand, sectors, buckets);

  const totalHeadcountTarget = Array.from(sectorDemand.values()).reduce((sum, n) => sum + n, 0);

  return {
    config,
    workforceTotal,
    totalHeadcountTarget,
    totalMembers: buckets.totalMembers,
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

// The dashboard returns only top-line totals — it has no per-bucket supply breakdown — so it does NOT
// need the expensive V2 supply-match work the full model does (the per-member expansion across every
// occupation in a member's sector, and the DISTINCT profile-skill -> job-title join). Running the full
// model here made the most-loaded workforce endpoint compute work it never returns; at production data
// scale that extra join/expansion can exceed the DB statement timeout and throw, which the dashboard
// route turns into a 503 that blanks the whole page. This lightweight summary reads only what the
// dashboard shows: the config, the sector demand, and two counts. recruitedTotal mirrors the full model
// exactly (the count of all active Directory profiles), so the numbers never diverge.
export async function getDashboard(): Promise<WorkforceDashboard> {
  const config = await getWorkforceConfig();
  const workforceTotal = Math.max(0, Math.round(config.population * config.participationRate));

  const [sectorsRes, occupationsCountRes, membersCountRes] = await Promise.all([
    queryDb<SectorModelRow>(
      `SELECT id::text AS id, name, workforce_share::text AS workforce_share
       FROM skills_taxonomy_sectors
       WHERE is_active = TRUE`,
    ),
    queryDb<CountRow>(
      `SELECT COUNT(*)::text AS total FROM skills_taxonomy_job_titles WHERE is_active = TRUE`,
    ),
    queryDb<CountRow>(
      `SELECT COUNT(*)::text AS total
       FROM directory_profiles
       WHERE is_active = TRUE AND deleted_at IS NULL`,
    ),
  ]);

  const sectors = sectorsRes.rows;
  const sectorDemand = buildSectorDemand(sectors, workforceTotal);
  const totalHeadcountTarget = Array.from(sectorDemand.values()).reduce((sum, n) => sum + n, 0);
  const totalMembers = Math.max(0, Number.parseInt(membersCountRes.rows[0]?.total ?? '0', 10) || 0);
  const occupationsTotal = Math.max(0, Number.parseInt(occupationsCountRes.rows[0]?.total ?? '0', 10) || 0);
  // Top-line recruited mirrors V2 exactly: the count of all active Directory profiles.
  const recruitedTotal = totalMembers;

  return {
    population: config.population,
    participationRate: config.participationRate,
    workforceTotal,
    totalHeadcountTarget,
    totalMembers,
    recruitedTotal,
    percentRecruited: percentRecruited(recruitedTotal, totalHeadcountTarget),
    remainingCapacity: Math.max(0, config.maxRecruitable - recruitedTotal),
    minRecruitable: config.minRecruitable,
    maxRecruitable: config.maxRecruitable,
    sectorsTotal: sectors.length,
    occupationsTotal,
    generatedAtIso: new Date().toISOString(),
  };
}

// Public, signed-out snapshot for the Workforce landing page. Returns two coarse aggregate counts —
// Recruited (active members) and Sector Gaps (active sectors with demand) — derived from the same
// projection model the signed-in dashboard uses. No per-member rows, no identifying data, so it is
// safe to serve without authentication. The unfilled-headcount-target figure ("Not Recruited") is
// intentionally NOT exposed here: against the 5M goal it is a multi-million number that reads as
// off-putting marketing on the public landing, so it stays out of both this response and the page.
export async function getWorkforcePublicSnapshot(): Promise<{
  recruited: number;
  sectorGaps: number;
  generatedAtIso: string;
}> {
  const dashboard = await getDashboard();
  return {
    recruited: dashboard.recruitedTotal,
    sectorGaps: dashboard.sectorsTotal,
    generatedAtIso: dashboard.generatedAtIso,
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
    annualTrainingTarget: deriveAnnualTrainingTarget(occ.target, occ.skillLevel),
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
    annualTrainingTarget: deriveAnnualTrainingTarget(occ.target, occ.skillLevel),
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
    recruitedState: true,
    recruitedResolvedAtIso: null,
    availabilityPreferences: normalizeJsonObject(extension?.availability_preferences),
    workPreferences: normalizeJsonObject(extension?.work_preferences),
    serviceDeletedAtIso: extension?.service_deleted_at ? toIso(extension.service_deleted_at) : null,
    updatedAtIso: toIso(row.updated_at),
  };
}

export type WorkforceSoftDeleteOutcome = 'deleted' | 'already_deleted' | 'not_found';

// Service-scoped soft delete (deletion contract section 5): set service_deleted_at = NOW() and reset
// both preference payloads to empty objects on workforce_user_extension (a workforce-owned table —
// Directory and Skills Taxonomy are never touched).
//   - 'not_found'       : the caller has no claimed Directory profile (nothing to delete).
//   - 'already_deleted' : the profile was already service-deleted; this is an idempotent no-op, so the
//                         caller should NOT write a second deletion event.
//   - 'deleted'         : the soft delete was applied now.
export async function softDeleteOwnProfile(userId: string): Promise<WorkforceSoftDeleteOutcome> {
  const profile = await getOwnProfile(userId);
  if (!profile) {
    return 'not_found';
  }
  if (profile.serviceDeletedAtIso) {
    return 'already_deleted';
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

  return 'deleted';
}

// requested_at is the time the caller captured before any awaits (when the request was received);
// processed_at is when this row is written (NOW() in SQL), so the two timestamps are genuinely
// distinct as the deletion contract (section 8) requires.
export async function insertWorkforceDeletionEvent(input: {
  userId: string;
  scope: string;
  result: string;
  requestedAt: Date;
  requestId: string | null;
  traceId: string | null;
}): Promise<void> {
  await queryDb(
    `
      INSERT INTO workforce_deletion_events
        (user_id, scope, plugin_id, requested_at, processed_at, result, request_id, trace_id)
      VALUES ($1, $2, 'workforce', $3, NOW(), $4, $5, $6)
    `,
    [
      input.userId,
      input.scope,
      input.requestedAt,
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

  // Config drives the whole model's demand numbers; drop the cached model so the next read recomputes
  // with the new config instead of serving the pre-update snapshot for up to the cache TTL.
  invalidateWorkforceModelCache();

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
