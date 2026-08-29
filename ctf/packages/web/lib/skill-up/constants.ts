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

export const SKILL_UP_DEFAULT_STARTER_CREDITS = 500;
export const SKILL_UP_DEFAULT_TRAINER_SPLIT_PERCENT = 25;

// The retired auto-cohort scheduler (issue #904, removed 2026-08-29) was the actor on every cohort
// it stood up, so one of those cohorts that still carries this id has no human trainer yet ("needs
// trainer"). A trainer claiming the cohort replaces created_by_user_id with their own id. Nothing
// writes this id any more; it is read to recognize the cohorts already created under it.
export const SKILL_UP_AUTO_COHORT_ACTOR_ID = 'skill-up-auto-cohort-scheduler';

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
