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

// Minimum check-ins on one day before that day's average is shown (owner decision, 2026-10-16;
// issue #2773). The week total above is not enough on its own: once it is met, a day holding one
// check-in would show that member's exact mood under a known date. A day below this shows no
// average and a zero count, so it reads the same as a day nobody checked in.
export const MOOD_PULSE_MIN_DAY_SAMPLE = 3;
