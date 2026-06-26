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
