export const MOOD_ERROR_CODE = {
  invalidPayload: 'mood_invalid_payload',
  cooldownActive: 'mood_cooldown_active',
  csrfDenied: 'mood_csrf_denied',
  persistenceUnavailable: 'mood_persistence_unavailable',
  eligibilityNotFound: 'mood_eligibility_not_found',
  unknown: 'mood_unknown',
} as const;

export const MOOD_COOLDOWN_DAYS = 7;

// Community Pulse aggregation window in days. We summarize check-ins over the
// trailing week so the chart matches the design's "7-day community mood".
export const MOOD_PULSE_WINDOW_DAYS = 7;

// Minimum total check-ins in the window before the aggregate is shown. Below
// this threshold we return an empty state so a handful of submissions can never
// be reverse-engineered into anything resembling an individual mood.
export const MOOD_PULSE_MIN_SAMPLE = 5;
