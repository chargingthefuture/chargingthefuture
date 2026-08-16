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

// Skills Economy summary modeling constants (owner directive, 2026-08-16). The overview's summary
// statement is the ONLY place in the app where GDP is stated in US dollars, and it is explicitly
// speculative, not actuals. The reference economies are small advanced nation states (Finland,
// Estonia, Singapore); the per-person figure is the upper benchmark of the three — Singapore's GDP
// per person (purchasing-power basis, ~$141k IMF 2024), rounded to a clean modeling constant.
// Speculative GDP potential = recruited × this benchmark (94 recruited ≈ $13.4 million).
export const WORKFORCE_BENCHMARK_GDP_PER_PERSON_USD = 142_500;
// Share of a person's GDP contribution that reaches them as earnings. Advanced economies pay out
// roughly half to two-thirds of GDP as compensation; the lower bound backs the statement's
// "earning upwards of" phrasing.
export const WORKFORCE_EARNINGS_SHARE_OF_GDP = 0.5;
