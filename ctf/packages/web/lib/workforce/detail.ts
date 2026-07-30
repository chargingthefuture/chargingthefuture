import { queryDb } from 'lib/db/postgres';
import { computeWorkforceModel, type WorkforceModel } from './repository';
import { deriveWorkforceSkillLevel, type WorkforceSkillLevel } from './skill-level';
import type {
  WorkforceBucketDetail,
  WorkforceMatchedMember,
  WorkforceMatchReason,
} from './types';

// ---------------------------------------------------------------------------
// Sector / skill-level drilldowns (the V2 member list)
//
// A bucket drilldown is the aggregate row (target/recruited/gap, reused from computeWorkforceModel so
// the numbers match the dashboard) plus the list of Directory members that match the bucket by the V2
// 3-way rule — same sector, same job title, or a skill registered under the job title. Read-only;
// nothing is written. Member names are shown by design (see WorkforceMatchedMember).
// ---------------------------------------------------------------------------

type ProfileRow = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  job_title_sector_id: string | null;
  job_title_sector_name: string | null;
  profile_sector_id: string | null;
  profile_sector_name: string | null;
  job_title_id: string | null;
  job_title_name: string | null;
};

type ProfileSkillRow = {
  profile_id: string;
  skill_name: string;
  job_title_id: string;
};

type JobTitleRow = { id: string; name: string; sector_id: string; sector_name: string };

type LoadedProfiles = {
  profiles: ProfileRow[];
  skillsByProfile: Map<string, ProfileSkillRow[]>;
  jobTitles: JobTitleRow[];
  jobTitleById: Map<string, JobTitleRow>;
};

async function loadProfilesForMatch(): Promise<LoadedProfiles> {
  const [profilesRes, skillsRes, jobTitlesRes] = await Promise.all([
    queryDb<ProfileRow>(
      `SELECT
         dp.id::text AS profile_id,
         dp.first_name AS first_name,
         dp.last_name AS last_name,
         jt.sector_id::text AS job_title_sector_id,
         jt_sec.name AS job_title_sector_name,
         dp.sector_id::text AS profile_sector_id,
         dp_sec.name AS profile_sector_name,
         dp.job_title_id::text AS job_title_id,
         jt.name AS job_title_name
       FROM directory_profiles dp
       LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = dp.job_title_id
       LEFT JOIN skills_taxonomy_sectors jt_sec ON jt_sec.id = jt.sector_id
       LEFT JOIN skills_taxonomy_sectors dp_sec ON dp_sec.id = dp.sector_id
       WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL`,
    ),
    // Rows are keyed by profile and only read for the active profiles loaded above, so there is no
    // need to re-join directory_profiles here (that join can fail on databases where the id column
    // types differ). Skills match by NAME, not by row (owner decision 2026-07-04, mirrors
    // computeWorkforceModel): `held` is the member's own skill row, `other` is every active
    // same-named row, so one (profile, skill name, job title) row exists per occupation the name is
    // listed under. The job-title join keeps only occupations that are active.
    queryDb<ProfileSkillRow>(
      `SELECT DISTINCT
         dps.profile_id::text AS profile_id,
         held.name AS skill_name,
         other.job_title_id::text AS job_title_id
       FROM directory_profile_skills dps
       JOIN skills_taxonomy_skills held ON held.id = dps.skill_id AND held.is_active = TRUE
       JOIN skills_taxonomy_skills other
         ON lower(btrim(other.name)) = lower(btrim(held.name)) AND other.is_active = TRUE
       JOIN skills_taxonomy_job_titles jt ON jt.id = other.job_title_id AND jt.is_active = TRUE`,
    ),
    queryDb<JobTitleRow>(
      `SELECT jt.id::text AS id, jt.name AS name, jt.sector_id::text AS sector_id, sec.name AS sector_name
       FROM skills_taxonomy_job_titles jt
       JOIN skills_taxonomy_sectors sec ON sec.id = jt.sector_id
       WHERE jt.is_active = TRUE`,
    ),
  ]);

  const skillsByProfile = new Map<string, ProfileSkillRow[]>();
  for (const row of skillsRes.rows) {
    const list = skillsByProfile.get(row.profile_id) ?? [];
    list.push(row);
    skillsByProfile.set(row.profile_id, list);
  }

  const jobTitleById = new Map(jobTitlesRes.rows.map((jt) => [jt.id, jt] as const));

  return { profiles: profilesRes.rows, skillsByProfile, jobTitles: jobTitlesRes.rows, jobTitleById };
}

// Count, for one profile, how many of its skills map to each sector through the taxonomy.
function tallySectorsBySkill(p: ProfileRow, loaded: LoadedProfiles): Map<string, number> {
  const tally = new Map<string, number>();
  for (const skill of loaded.skillsByProfile.get(p.profile_id) ?? []) {
    const jt = loaded.jobTitleById.get(skill.job_title_id);
    if (!jt) continue;
    tally.set(jt.sector_id, (tally.get(jt.sector_id) ?? 0) + 1);
  }
  return tally;
}

// A candidate sector beats the current best when its count is higher, or ties on count and sorts
// earlier by sector name (ties broken by sector name).
function sectorWins(
  count: number,
  name: string,
  bestCount: number,
  bestId: string | null,
  bestName: string | null,
): boolean {
  return count > bestCount
    || (count === bestCount && bestId !== null && name < (bestName ?? ''));
}

// The plurality sector from a skill tally (ties broken by sector name), or null when the tally is empty.
function pickPluralitySector(
  tally: Map<string, number>,
  loaded: LoadedProfiles,
): { id: string; name: string } | null {
  let bestId: string | null = null;
  let bestName: string | null = null;
  let bestCount = 0;
  for (const [sectorId, count] of tally) {
    const name = loaded.jobTitles.find((jt) => jt.sector_id === sectorId)?.sector_name ?? '';
    if (sectorWins(count, name, bestCount, bestId, bestName)) {
      bestId = sectorId;
      bestName = name;
      bestCount = count;
    }
  }
  return bestId ? { id: bestId, name: bestName ?? '' } : null;
}

// The member's own sector, by spec precedence (mirrors computeWorkforceModel): the chosen
// occupation's sector, else the sector the member's skills map to through the taxonomy (plurality,
// ties broken by sector name), else the raw profile sector field.
function resolveOwnSector(
  p: ProfileRow,
  loaded: LoadedProfiles,
): { id: string | null; name: string | null } {
  if (p.job_title_sector_id) {
    return { id: p.job_title_sector_id, name: p.job_title_sector_name };
  }
  const best = pickPluralitySector(tallySectorsBySkill(p, loaded), loaded);
  if (best) {
    return best;
  }
  return { id: p.profile_sector_id, name: p.profile_sector_name };
}

function displayName(p: ProfileRow): string {
  const name = [p.first_name, p.last_name].filter((s) => s && s.trim()).join(' ').trim();
  return name || 'Member';
}

// jobTitle > skill > sector. Returns the stronger of two reasons.
export function strongerReason(a: WorkforceMatchReason, b: WorkforceMatchReason): WorkforceMatchReason {
  const rank: Record<WorkforceMatchReason, number> = { none: 0, sector: 1, skill: 2, jobTitle: 3 };
  return rank[b] > rank[a] ? b : a;
}

// The V2 3-way rule for one profile against one occupation: jobTitle wins, else a skill registered
// under the occupation, else the sector arm (true only when the occupation is in the profile's own
// sector). Returns 'none' when the profile does not match the occupation.
function occupationMatchReason(
  p: ProfileRow,
  jt: JobTitleRow,
  skillJobTitleIds: Set<string>,
  sectorArmAppliesTo: (jt: JobTitleRow) => boolean,
): WorkforceMatchReason {
  if (p.job_title_id && p.job_title_id === jt.id) {
    return 'jobTitle';
  }
  if (skillJobTitleIds.has(jt.id)) {
    return 'skill';
  }
  if (sectorArmAppliesTo(jt)) {
    return 'sector';
  }
  return 'none';
}

// One matched-occupation entry. `viaSkills` is the member's skills registered under THIS occupation —
// the evidence for a skill match, so the display never implies the member's unrelated skills caused it.
function buildMatchingOccupation(
  jt: JobTitleRow,
  occReason: WorkforceMatchReason,
  profileSkills: ProfileSkillRow[],
  gapByJobTitleId: Map<string, number>,
): WorkforceMatchedMember['matchingOccupations'][number] {
  const viaSkills = occReason === 'skill'
    ? Array.from(new Set(profileSkills.filter((s) => s.job_title_id === jt.id).map((s) => s.skill_name)))
    : [];
  return {
    id: jt.id,
    title: jt.name,
    sector: jt.sector_name,
    reason: occReason,
    viaSkills,
    gap: gapByJobTitleId.get(jt.id) ?? 0,
  };
}

// Build a matched-member entry for one profile against a set of candidate occupations (job titles),
// using the V2 3-way rule. `sectorArmAppliesTo(jobTitle)` decides when the profile's own sector counts
// the profile toward that occupation (true only when the occupation is in the profile's own sector).
function buildMatch(
  p: ProfileRow,
  loaded: LoadedProfiles,
  candidates: JobTitleRow[],
  sectorArmAppliesTo: (jt: JobTitleRow) => boolean,
  gapByJobTitleId: Map<string, number>,
): WorkforceMatchedMember | null {
  const profileSkills = loaded.skillsByProfile.get(p.profile_id) ?? [];
  const skillJobTitleIds = new Set(profileSkills.map((s) => s.job_title_id));

  const matchingOccupations: WorkforceMatchedMember['matchingOccupations'] = [];
  let reason: WorkforceMatchReason = 'none';

  for (const jt of candidates) {
    const occReason = occupationMatchReason(p, jt, skillJobTitleIds, sectorArmAppliesTo);
    if (occReason !== 'none') {
      matchingOccupations.push(buildMatchingOccupation(jt, occReason, profileSkills, gapByJobTitleId));
      reason = strongerReason(reason, occReason);
    }
  }

  if (reason === 'none') {
    return null;
  }

  const skillNames = Array.from(new Set(profileSkills.map((s) => s.skill_name).filter(Boolean)));
  const ownSector = resolveOwnSector(p, loaded);

  return {
    profileId: p.profile_id,
    displayName: displayName(p),
    skills: skillNames,
    sectors: ownSector.name ? [ownSector.name] : [],
    jobTitles: p.job_title_name ? [p.job_title_name] : [],
    matchingOccupations,
    matchReason: reason,
  };
}

export function sortMembers(members: WorkforceMatchedMember[]): WorkforceMatchedMember[] {
  const rank: Record<WorkforceMatchReason, number> = { jobTitle: 0, skill: 1, sector: 2, none: 3 };
  return members.sort(
    (a, b) => rank[a.matchReason] - rank[b.matchReason] || a.displayName.localeCompare(b.displayName),
  );
}

// Build the drilldown for a single sector against already-loaded model + profile data. Kept separate
// from fetchSectorDetail so a caller that needs several sectors at once (the community-planning team
// rosters) can load the model and the profile set ONCE and reuse them across every sector, instead of
// re-running loadProfilesForMatch per sector.
function computeSectorMatchedMembers(
  sectorName: string,
  model: WorkforceModel,
  loaded: LoadedProfiles,
  gapByJobTitleId: Map<string, number>,
): WorkforceBucketDetail | null {
  const target = sectorName.toLowerCase();
  const bucket = model.sectors.find((s) => s.bucket.toLowerCase() === target);
  if (!bucket) {
    return null;
  }
  // The occupations of this sector (matched by the sector's display name, since that is what the
  // model bucket and the route carry). The sector arm applies to every occupation in this sector.
  const sectorJobTitles = loaded.jobTitles.filter((jt) => jt.sector_name.toLowerCase() === target);
  const sectorIds = new Set(sectorJobTitles.map((jt) => jt.sector_id));

  const matchedMembers: WorkforceMatchedMember[] = [];
  for (const p of loaded.profiles) {
    const ownSectorId = resolveOwnSector(p, loaded).id;
    const ownSectorInBucket = ownSectorId != null && sectorIds.has(ownSectorId);
    const match = buildMatch(p, loaded, sectorJobTitles, () => ownSectorInBucket, gapByJobTitleId);
    if (match) {
      matchedMembers.push(match);
    }
  }

  return { ...bucket, matchedMembers: sortMembers(matchedMembers) };
}

export async function fetchSectorDetail(sector: string): Promise<WorkforceBucketDetail | null> {
  const model = await computeWorkforceModel();
  const loaded = await loadProfilesForMatch();
  const gapByJobTitleId = new Map(model.occupations.map((o) => [o.jobTitleId, o.gap] as const));
  return computeSectorMatchedMembers(sector, model, loaded, gapByJobTitleId);
}

// Drilldowns for several sectors in one pass. Loads the workforce model and the Directory profile set
// once, then computes each requested sector against that shared data. Sector names are matched
// case-insensitively and de-duplicated; a requested sector with no taxonomy bucket is simply absent
// from the returned map (the caller reports it as a coverage gap). Key = sector name lowercased.
export async function fetchSectorDetailsForSectors(
  sectors: string[],
): Promise<Map<string, WorkforceBucketDetail>> {
  const model = await computeWorkforceModel();
  const loaded = await loadProfilesForMatch();
  const gapByJobTitleId = new Map(model.occupations.map((o) => [o.jobTitleId, o.gap] as const));

  const out = new Map<string, WorkforceBucketDetail>();
  for (const sector of sectors) {
    const key = sector.toLowerCase();
    if (out.has(key)) {
      continue;
    }
    const detail = computeSectorMatchedMembers(sector, model, loaded, gapByJobTitleId);
    if (detail) {
      out.set(key, detail);
    }
  }
  return out;
}

export async function fetchSkillLevelDetail(skillLevel: string): Promise<WorkforceBucketDetail | null> {
  const model = await computeWorkforceModel();
  const target = skillLevel.toLowerCase();
  const bucket = model.skillLevels.find((s) => s.bucket.toLowerCase() === target);
  if (!bucket) {
    return null;
  }

  const level = bucket.bucket as WorkforceSkillLevel;
  const loaded = await loadProfilesForMatch();
  const gapByJobTitleId = new Map(model.occupations.map((o) => [o.jobTitleId, o.gap] as const));
  // The occupations at this skill level (across all sectors). The sector arm applies to an occupation
  // only when it sits in the profile's own sector.
  const levelJobTitles = loaded.jobTitles.filter((jt) => deriveWorkforceSkillLevel(jt.name) === level);

  const matchedMembers: WorkforceMatchedMember[] = [];
  for (const p of loaded.profiles) {
    const ownSectorId = resolveOwnSector(p, loaded).id;
    const match = buildMatch(p, loaded, levelJobTitles, (jt) => ownSectorId != null && ownSectorId === jt.sector_id, gapByJobTitleId);
    if (match) {
      matchedMembers.push(match);
    }
  }

  return { ...bucket, matchedMembers: sortMembers(matchedMembers) };
}
