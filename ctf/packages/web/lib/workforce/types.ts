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
  generatedAtIso: string;
};

export type WorkforceProfile = {
  userId: string;
  occupationId: string | null;
  occupationName: string | null;
  skillLevel: string;
  region: string | null;
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
  members: number; // active Directory profiles in this occupation
  recruited: number; // claimed Directory profiles in this occupation
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

export type WorkforceSummaryReport = {
  population: number;
  workforceTotal: number;
  totalHeadcountTarget: number;
  totalMembers: number;
  recruitedTotal: number;
  percentRecruited: number;
  generatedAtIso: string;
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
