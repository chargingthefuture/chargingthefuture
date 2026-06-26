import { queryDb } from 'lib/db/postgres';
import { computeWorkforceModel } from './repository';
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
  sector_id: string | null;
  sector_name: string | null;
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
         COALESCE(jt.sector_id, dp.sector_id)::text AS sector_id,
         COALESCE(jt_sec.name, dp_sec.name) AS sector_name,
         dp.job_title_id::text AS job_title_id,
         jt.name AS job_title_name
       FROM directory_profiles dp
       LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = dp.job_title_id
       LEFT JOIN skills_taxonomy_sectors jt_sec ON jt_sec.id = jt.sector_id
       LEFT JOIN skills_taxonomy_sectors dp_sec ON dp_sec.id = dp.sector_id
       WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL`,
    ),
    queryDb<ProfileSkillRow>(
      `SELECT
         dps.profile_id::text AS profile_id,
         sts.name AS skill_name,
         sts.job_title_id::text AS job_title_id
       FROM directory_profile_skills dps
       JOIN skills_taxonomy_skills sts ON sts.id = dps.skill_id AND sts.is_active = TRUE
       JOIN skills_taxonomy_job_titles jt ON jt.id = sts.job_title_id AND jt.is_active = TRUE
       JOIN directory_profiles dp ON dp.id = dps.profile_id
       WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL`,
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

function displayName(p: ProfileRow): string {
  const name = [p.first_name, p.last_name].filter((s) => s && s.trim()).join(' ').trim();
  return name || 'Member';
}

// jobTitle > skill > sector. Returns the stronger of two reasons.
function strongerReason(a: WorkforceMatchReason, b: WorkforceMatchReason): WorkforceMatchReason {
  const rank: Record<WorkforceMatchReason, number> = { none: 0, sector: 1, skill: 2, jobTitle: 3 };
  return rank[b] > rank[a] ? b : a;
}

// Build a matched-member entry for one profile against a set of candidate occupations (job titles),
// using the V2 3-way rule. `sectorArmAppliesTo(jobTitle)` decides when the profile's own sector counts
// the profile toward that occupation (true only when the occupation is in the profile's own sector).
function buildMatch(
  p: ProfileRow,
  loaded: LoadedProfiles,
  candidates: JobTitleRow[],
  sectorArmAppliesTo: (jt: JobTitleRow) => boolean,
): WorkforceMatchedMember | null {
  const profileSkills = loaded.skillsByProfile.get(p.profile_id) ?? [];
  const skillJobTitleIds = new Set(profileSkills.map((s) => s.job_title_id));

  const matchingOccupations: Array<{ id: string; title: string; sector: string }> = [];
  let reason: WorkforceMatchReason = 'none';

  for (const jt of candidates) {
    let occReason: WorkforceMatchReason = 'none';
    if (p.job_title_id && p.job_title_id === jt.id) {
      occReason = 'jobTitle';
    } else if (skillJobTitleIds.has(jt.id)) {
      occReason = 'skill';
    } else if (sectorArmAppliesTo(jt)) {
      occReason = 'sector';
    }
    if (occReason !== 'none') {
      matchingOccupations.push({ id: jt.id, title: jt.name, sector: jt.sector_name });
      reason = strongerReason(reason, occReason);
    }
  }

  if (reason === 'none') {
    return null;
  }

  const skillNames = Array.from(new Set(profileSkills.map((s) => s.skill_name).filter(Boolean)));

  return {
    profileId: p.profile_id,
    displayName: displayName(p),
    skills: skillNames,
    sectors: p.sector_name ? [p.sector_name] : [],
    jobTitles: p.job_title_name ? [p.job_title_name] : [],
    matchingOccupations,
    matchReason: reason,
  };
}

function sortMembers(members: WorkforceMatchedMember[]): WorkforceMatchedMember[] {
  const rank: Record<WorkforceMatchReason, number> = { jobTitle: 0, skill: 1, sector: 2, none: 3 };
  return members.sort(
    (a, b) => rank[a.matchReason] - rank[b.matchReason] || a.displayName.localeCompare(b.displayName),
  );
}

export async function fetchSectorDetail(sector: string): Promise<WorkforceBucketDetail | null> {
  const model = await computeWorkforceModel();
  const target = sector.toLowerCase();
  const bucket = model.sectors.find((s) => s.bucket.toLowerCase() === target);
  if (!bucket) {
    return null;
  }

  const loaded = await loadProfilesForMatch();
  // The occupations of this sector (matched by the sector's display name, since that is what the
  // model bucket and the route carry). The sector arm applies to every occupation in this sector.
  const sectorJobTitles = loaded.jobTitles.filter((jt) => jt.sector_name.toLowerCase() === target);
  const sectorIds = new Set(sectorJobTitles.map((jt) => jt.sector_id));

  const matchedMembers: WorkforceMatchedMember[] = [];
  for (const p of loaded.profiles) {
    const ownSectorInBucket = p.sector_id != null && sectorIds.has(p.sector_id);
    const match = buildMatch(p, loaded, sectorJobTitles, () => ownSectorInBucket);
    if (match) {
      matchedMembers.push(match);
    }
  }

  return { ...bucket, matchedMembers: sortMembers(matchedMembers) };
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
  // The occupations at this skill level (across all sectors). The sector arm applies to an occupation
  // only when it sits in the profile's own sector.
  const levelJobTitles = loaded.jobTitles.filter((jt) => deriveWorkforceSkillLevel(jt.name) === level);

  const matchedMembers: WorkforceMatchedMember[] = [];
  for (const p of loaded.profiles) {
    const match = buildMatch(p, loaded, levelJobTitles, (jt) => p.sector_id != null && p.sector_id === jt.sector_id);
    if (match) {
      matchedMembers.push(match);
    }
  }

  return { ...bucket, matchedMembers: sortMembers(matchedMembers) };
}
