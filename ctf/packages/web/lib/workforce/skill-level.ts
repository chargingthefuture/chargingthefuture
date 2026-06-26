// Workforce skill level, derived from a profile's job-title name.
//
// Ported verbatim from V2 (ctf-v2-deprecated `scripts/seedWorkforceRecruiter.ts`): the level is a
// case-insensitive substring match on the job-title name. Advanced is checked first, then
// Foundational; anything else is Intermediate. There is no stored skill-level field — it is
// computed live from the Skills Taxonomy job title (the single source of truth), so it can never
// drift and needs no extra column or seed.

export type WorkforceSkillLevel = 'Foundational' | 'Intermediate' | 'Advanced';

export const WORKFORCE_SKILL_LEVELS: readonly WorkforceSkillLevel[] = [
  'Foundational',
  'Intermediate',
  'Advanced',
];

const ADVANCED_KEYWORDS = [
  'engineer', 'scientist', 'doctor', 'surgeon', 'architect', 'manager', 'director', 'specialist',
  'analyst', 'consultant', 'therapist', 'counselor', 'teacher', 'instructor', 'coordinator',
];

const FOUNDATIONAL_KEYWORDS = [
  'helper', 'assistant', 'aide', 'laborer', 'cleaner', 'porter', 'guard', 'attendant',
];

export function deriveWorkforceSkillLevel(jobTitleName: string | null | undefined): WorkforceSkillLevel {
  const lowerName = (jobTitleName ?? '').toLowerCase();
  if (ADVANCED_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
    return 'Advanced';
  }
  if (FOUNDATIONAL_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
    return 'Foundational';
  }
  return 'Intermediate';
}

// V2 seeded an "annual training target" as a percentage of headcount that varied by skill level
// (Foundational 5–15%, Intermediate 10–20%, Advanced 20–30%). V3 stores no occupation, so we derive
// it live from the occupation demand using the midpoint of each V2 range — deterministic, no column.
const ANNUAL_TRAINING_SHARE: Record<WorkforceSkillLevel, number> = {
  Foundational: 0.1,
  Intermediate: 0.15,
  Advanced: 0.25,
};

export function deriveAnnualTrainingTarget(demand: number, skillLevel: WorkforceSkillLevel): number {
  return Math.round(Math.max(0, demand) * ANNUAL_TRAINING_SHARE[skillLevel]);
}
