export const WORKFORCE_PLUGIN_ID = 'workforce';

export const WORKFORCE_ERROR_CODE = {
  invalidPayload: 'WORKFORCE_INVALID_PAYLOAD',
  notFound: 'WORKFORCE_NOT_FOUND',
  conflict: 'WORKFORCE_CONFLICT',
  persistenceUnavailable: 'WORKFORCE_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'WORKFORCE_CSRF_DENIED',
} as const;

export const WORKFORCE_DEFAULT_PAGE = 1;
export const WORKFORCE_DEFAULT_PAGE_SIZE = 20;
export const WORKFORCE_MAX_PAGE_SIZE = 100;

export const WORKFORCE_MAX_REGION_LENGTH = 80;

// Workforce config defaults. The population baseline (5,000,000 survivors) and a 0.5 participation
// rate model a thriving population (researched against economies the size of Finland / Singapore).
// These are the workforce plugin's own config — they are never written to Directory or Skills
// Taxonomy. Demand is derived from population * participationRate, distributed across sectors by each
// sector's Skills Taxonomy workforce share.
export const WORKFORCE_DEFAULT_POPULATION = 5_000_000;
export const WORKFORCE_DEFAULT_PARTICIPATION_RATE = 0.5;
export const WORKFORCE_DEFAULT_MIN_RECRUITABLE = 2_000_000;
export const WORKFORCE_DEFAULT_MAX_RECRUITABLE = 5_000_000;

// The number of documented skills a functioning economy needs — the point at which the community can
// meet its own needs. Coverage toward it is the count of DIFFERENT skills at least one active
// Directory member has listed, NOT the size of the skills catalog (the catalog already holds all 650
// options and would always read 100%). Same baseline the weekly community-stats draft uses
// (ctf/scripts/generate-community-stats.mjs, FULL_ECONOMY_SKILL_BASELINE) — keep the two in sync.
export const WORKFORCE_SKILLS_ECONOMY_BASELINE = 650;
