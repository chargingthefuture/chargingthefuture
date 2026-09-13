export const SKILL_UP_PLUGIN_SLUG = 'skill-up';

export const SKILL_UP_ERROR_CODE = {
  invalidPayload: 'skill_up_invalid_payload',
  invalidJson: 'skill_up_invalid_json',
  notFound: 'skill_up_not_found',
  invalidState: 'skill_up_invalid_state',
  insufficientBalance: 'skill_up_insufficient_balance',
  rateLimitExceeded: 'skill_up_rate_limit_exceeded',
  forbidden: 'skill_up_forbidden',
  unavailable: 'skill_up_unavailable',
} as const;

// Unused. Kept only so its absence is not mistaken for a grant that exists: nothing in this codebase
// hands a new member starting credits. The credits a member actually begins with come from Unlock
// approval (`unlock_quora_verification_approval`), plus their mutual-credit line.
export const SKILL_UP_DEFAULT_STARTER_CREDITS = 500;

// Every cohort takes the same deposit, from every member (owner decision 2026-08-29). Flat and small
// on purpose: it is a commitment device, and a per-cohort or per-occupation figure would be a
// judgment call, which is bias. It is never zero.
//
// 50 sits against what a member actually holds — the Unlock approval grant, with the mutual-credit
// line behind it — so joining two cohorts does not require going into credit-debt. The deposit is
// held in escrow and returned in full as each milestone is validated; leaving a cohort refunds
// whatever is still held. It is not spent.
export const SKILL_UP_DEPOSIT_CREDITS = 50;

// What a trainer receives per milestone, per learner, before the gap scaling below. Minted, not
// taken from the learner's deposit.
export const SKILL_UP_TRAINER_BASE_CREDITS_PER_MILESTONE = 10;

// Training a short occupation earns more: the Workforce gap scales the trainer's rate between these
// bounds. Capped so one outlier occupation cannot dominate, and floored at the base so a small gap
// never pays less than the flat rate.
export const SKILL_UP_TRAINER_GAP_MULTIPLIER_MIN = 1;
export const SKILL_UP_TRAINER_GAP_MULTIPLIER_MAX = 2;
export const SKILL_UP_DEFAULT_TRAINER_SPLIT_PERCENT = 25;

// Auto-cohort creation (issue #904). The scheduled run is the actor on every cohort it stands up,
// so an auto-created cohort that still carries this id has no human trainer yet ("needs trainer").
// A trainer claiming the cohort replaces created_by_user_id with their own id.
export const SKILL_UP_AUTO_COHORT_ACTOR_ID = 'skill-up-auto-cohort-scheduler';

// Coded fallbacks used when the skill_up_auto_cohort_config singleton row has not been written yet.
// These mirror the column defaults in schema.sql and the lean launch policy agreed for issue #904.
export const SKILL_UP_AUTO_COHORT_DEFAULTS = {
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
export const SKILL_UP_PROPOSAL_TERM_MONTHS = [1, 3, 5] as const;
export type SkillUpProposalTermMonths = (typeof SKILL_UP_PROPOSAL_TERM_MONTHS)[number];

// Default milestone skeleton stamped onto every auto-created cohort (issue #904). Milestones are what
// drive the escrow split, the trainer payout, and the completion bonus on release — without them an
// auto cohort has no progression or payout path. percentRelease values must sum to 100.
export const SKILL_UP_AUTO_COHORT_DEFAULT_MILESTONES = [
  { name: 'Kickoff & Fundamentals', percentRelease: 40, requiredTask: 'Complete the foundational module and the intro check-in with your trainer.' },
  { name: 'Applied Practice', percentRelease: 30, requiredTask: 'Submit the practical exercise for trainer review.' },
  { name: 'Capstone & Sign-off', percentRelease: 30, requiredTask: 'Complete the capstone and pass the final trainer validation.' },
] as const;

export const SKILL_UP_RATE_LIMIT = {
  enrollPerMinute: 6,
  milestoneValidatePerMinute: 20,
} as const;

export const SKILL_UP_STATUS = {
  cohort: ['draft', 'open', 'active', 'completed', 'canceled'] as const,
  enrollment: ['enrolled', 'active', 'completed', 'dropped'] as const,
  milestoneValidation: ['validated', 'released', 'disputed'] as const,
  dispute: ['open', 'under_review', 'resolved', 'dismissed'] as const,
} as const;

export type CohortStatus = (typeof SKILL_UP_STATUS.cohort)[number];
export type EnrollmentStatus = (typeof SKILL_UP_STATUS.enrollment)[number];
export type MilestoneValidationStatus = (typeof SKILL_UP_STATUS.milestoneValidation)[number];
export type DisputeStatus = (typeof SKILL_UP_STATUS.dispute)[number];
