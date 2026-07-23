export const LEVEL_UP_PLUGIN_SLUG = 'level-up';

export const LEVEL_UP_ERROR_CODE = {
  invalidPayload: 'level_up_invalid_payload',
  invalidJson: 'level_up_invalid_json',
  notFound: 'level_up_not_found',
  invalidState: 'level_up_invalid_state',
  insufficientBalance: 'level_up_insufficient_balance',
  rateLimitExceeded: 'level_up_rate_limit_exceeded',
  forbidden: 'level_up_forbidden',
  unavailable: 'level_up_unavailable',
} as const;

export const LEVEL_UP_DEFAULT_STARTER_CREDITS = 500;
export const LEVEL_UP_DEFAULT_TRAINER_SPLIT_PERCENT = 25;

// Auto-cohort creation (issue #904). The scheduled run is the actor on every cohort it stands up,
// so an auto-created cohort that still carries this id has no human trainer yet ("needs trainer").
// A trainer claiming the cohort replaces created_by_user_id with their own id.
export const LEVEL_UP_AUTO_COHORT_ACTOR_ID = 'level-up-auto-cohort-scheduler';

// Coded fallbacks used when the level_up_auto_cohort_config singleton row has not been written yet.
// These mirror the column defaults in schema.sql and the lean launch policy agreed for issue #904.
export const LEVEL_UP_AUTO_COHORT_DEFAULTS = {
  enabled: true,
  minGapThreshold: 25,
  maxConcurrent: 3,
  perSectorCap: 1,
  skillLevelFilter: 'Foundational' as const,
  topN: 10,
  defaultTermDays: 90,
  defaultSeats: 12,
  // Economic policy applied to every auto-created cohort. One global policy for now; per-occupation
  // tuning is deferred (issue #1197). 0 required credits = free to join (no deposit).
  defaultRequiredCredits: 0,
  defaultTrainerSplitPercent: 25,
  defaultCompletionBonusCredits: 0,
  // Proposal-queue cadence (owner decision 2026-07-23): re-read the Workforce gaps into proposals at
  // most this often. Cohort expiry is still checked on every run.
  generationIntervalDays: 90,
} as const;

// Term choices offered to the admin when approving a proposal (owner decision 2026-07-23): the admin
// picks one and the cohort opens with that end date. Months, not days, so the term reads naturally.
export const LEVEL_UP_PROPOSAL_TERM_MONTHS = [1, 3, 5] as const;
export type LevelUpProposalTermMonths = (typeof LEVEL_UP_PROPOSAL_TERM_MONTHS)[number];

// Default milestone skeleton stamped onto every auto-created cohort (issue #904). Milestones are what
// drive the escrow split, the trainer payout, and the completion bonus on release — without them an
// auto cohort has no progression or payout path. percentRelease values must sum to 100.
export const LEVEL_UP_AUTO_COHORT_DEFAULT_MILESTONES = [
  { name: 'Kickoff & Fundamentals', percentRelease: 40, requiredTask: 'Complete the foundational module and the intro check-in with your trainer.' },
  { name: 'Applied Practice', percentRelease: 30, requiredTask: 'Submit the practical exercise for trainer review.' },
  { name: 'Capstone & Sign-off', percentRelease: 30, requiredTask: 'Complete the capstone and pass the final trainer validation.' },
] as const;

export const LEVEL_UP_RATE_LIMIT = {
  enrollPerMinute: 6,
  milestoneValidatePerMinute: 20,
} as const;

export const LEVEL_UP_STATUS = {
  cohort: ['draft', 'open', 'active', 'completed', 'cancelled'] as const,
  enrollment: ['enrolled', 'active', 'completed', 'dropped'] as const,
  milestoneValidation: ['validated', 'released', 'disputed'] as const,
  dispute: ['open', 'under_review', 'resolved', 'dismissed'] as const,
} as const;

export type CohortStatus = (typeof LEVEL_UP_STATUS.cohort)[number];
export type EnrollmentStatus = (typeof LEVEL_UP_STATUS.enrollment)[number];
export type MilestoneValidationStatus = (typeof LEVEL_UP_STATUS.milestoneValidation)[number];
export type DisputeStatus = (typeof LEVEL_UP_STATUS.dispute)[number];
