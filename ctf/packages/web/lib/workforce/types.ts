import type { WorkforceSkillLevel } from './skill-level';

export type WorkforcePagination = {
  page: number;
  pageSize: number;
  total: number;
};

// Live dashboard for the workforce tracker. Every number is derived read-only at request time:
// demand from Skills Taxonomy (sector workforce shares scaled by the workforce config), supply from
// Directory (members = active profiles, recruited = claimed profiles). Nothing here is stored.
export type WorkforceDashboard = {
  population: number;
  participationRate: number;
  workforceTotal: number; // population * participationRate
  totalHeadcountTarget: number; // sum of every sector's demand
  totalMembers: number; // active Directory profiles (claimed or not)
  recruitedTotal: number; // active Directory profiles that have been claimed
  percentRecruited: number; // recruitedTotal / totalHeadcountTarget * 100
  remainingCapacity: number; // maxRecruitable - recruitedTotal
  minRecruitable: number;
  maxRecruitable: number;
  sectorsTotal: number; // active Skills Taxonomy sectors
  occupationsTotal: number; // active Skills Taxonomy job titles
  skillsListedTotal: number; // distinct active skills at least one active Directory member has listed
  skillsCatalogTotal: number; // ALL active Skills Taxonomy skills — live count, moves as skills are added/removed
  generatedAtIso: string;
};

export type WorkforceProfile = {
  userId: string;
  occupationId: string | null;
  occupationName: string | null;
  skillLevel: string;
  recruitedState: boolean;
  recruitedResolvedAtIso: string | null;
  availabilityPreferences: Record<string, unknown>;
  workPreferences: Record<string, unknown>;
  serviceDeletedAtIso: string | null;
  updatedAtIso: string;
};

// An occupation in the workforce tracker is a Skills Taxonomy job title (read-only). Workforce never
// creates or edits occupations; it reads them and overlays the demand/supply numbers.
export type WorkforceOccupation = {
  id: string; // skills_taxonomy_job_titles.id
  name: string;
  // Always a string at runtime — the repository falls back to the 'Unassigned' bucket name rather than
  // null (matches the mobile WorkforceOccupationGapItem.sector type).
  sector: string;
  skillLevel: WorkforceSkillLevel;
  target: number; // demand share of this occupation
  // V2-style annual training target: a fixed share of the occupation demand by skill level
  // (Foundational 10%, Intermediate 15%, Advanced 25% — the midpoints of V2's seed ranges). V3 stores
  // no occupation, so this is derived live, not a stored admin value.
  annualTrainingTarget: number;
  members: number; // active Directory profiles in this occupation
  recruited: number; // distinct matched Directory profiles in this occupation (V2 aspirational match)
  gap: number; // max(0, target - recruited)
};

export type WorkforceConfig = {
  population: number;
  participationRate: number;
  minRecruitable: number;
  maxRecruitable: number;
  updatedByUserId: string;
  updatedAtIso: string;
};

export type WorkforceConfigInput = {
  population: number;
  participationRate: number;
  minRecruitable: number;
  maxRecruitable: number;
};

// One bucket of the sector or skill-level breakdown: demand (target) vs the live Directory supply
// (members = everyone, recruited = claimed). gap = max(0, target - recruited).
export type WorkforceGroupedReportItem = {
  bucket: string;
  target: number;
  members: number;
  recruited: number;
  gap: number;
};

// Per-occupation (job-title) training gap. This is the signal that later tells LevelUp which
// training cohort to stand up: a large gap = recruit and train for this occupation.
export type WorkforceOccupationGapItem = {
  jobTitleId: string;
  occupation: string;
  sector: string;
  skillLevel: WorkforceSkillLevel;
  target: number;
  members: number;
  recruited: number;
  gap: number;
};

// Why a Directory profile counts toward a sector / skill-level / occupation. Priority order when a
// profile matches more than one way: jobTitle > skill > sector (mirrors V2).
export type WorkforceMatchReason = 'sector' | 'jobTitle' | 'skill' | 'none';

// One matched member in a sector or skill-level drilldown (the V2 member list). Names are shown:
// Workforce requires sign-in and is a filtered view of the Directory whose purpose is surfacing who
// has or wants a skill, so there is no separate anonymization step here.
export type WorkforceMatchedMember = {
  profileId: string;
  displayName: string;
  skills: string[];
  sectors: string[];
  jobTitles: string[];
  // Each matched occupation carries its own reason, the member's skills that produced it (empty
  // unless the skill arm fired), and how many positions that occupation still has to fill in the
  // population model — so the display can show HOW a skilled member fills the demand instead of
  // implying their whole skill list caused every match.
  matchingOccupations: Array<{
    id: string;
    title: string;
    sector: string;
    reason: WorkforceMatchReason;
    viaSkills: string[];
    gap: number;
  }>;
  matchReason: WorkforceMatchReason;
};

// A single sector or skill-level bucket plus its matched-member list — the drilldown shape returned
// by GET /api/workforce/reports/sector/:sector and /reports/skill-level/:skillLevel for a specific
// (non-`all`) bucket. The aggregate fields mirror WorkforceGroupedReportItem.
export type WorkforceBucketDetail = {
  bucket: string;
  target: number;
  members: number;
  recruited: number;
  gap: number;
  matchedMembers: WorkforceMatchedMember[];
};
