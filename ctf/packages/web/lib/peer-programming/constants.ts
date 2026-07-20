export const PEER_PROGRAMMING_ERROR_CODE = {
  invalidPayload: 'peer_programming_invalid_payload',
  policyDenied: 'peer_programming_policy_denied',
  notFound: 'peer_programming_not_found',
  csrfDenied: 'peer_programming_csrf_denied',
  persistenceUnavailable: 'peer_programming_persistence_unavailable',
  streamUnavailable: 'peer_programming_stream_unavailable',
} as const;

export const PEER_PROGRAMMING_MAX_MESSAGE_LENGTH = 2000;
export const PEER_PROGRAMMING_MAX_FEEDBACK_LENGTH = 1000;
// Target headcount placed into each weekly cohort. Cohorts are formed at 12 members because
// participation is voluntary and asynchronous — placing ~12 gives a working group even when only
// about 5 actually show up and take part in a given week. This is the size of the weekly split in
// runWeeklyAssignment (paused while single standing Cohort 1 mode is on).
export const PEER_PROGRAMMING_COHORT_TARGET_SIZE = 12;

// Label for the single standing cohort used in low-population mode.
export const PEER_PROGRAMMING_STANDING_COHORT_LABEL = 'C1';

// How many members the room's "In this cohort" roster lists (the earliest joiners). The standing
// cohort can hold every active member, and each name is resolved via an external Clerk lookup, so an
// uncapped roster is unbounded work on every room load. The true total still shows separately as the
// cohort member count, so this caps the displayed chips, not the count.
export const PEER_PROGRAMMING_ROOM_ROSTER_LIMIT = 60;

// Single standing, always-open Cohort 1 mode (owner directive, temporary low-population mode).
// When ON there is one standing cohort (is_standing = TRUE) that any active member auto-joins on
// opening the room, the weekly auto-split is paused, and the cohort is not week-scoped. The flag
// DEFAULTS ON: unset or empty is treated as ON. Only the explicit values '0' or 'false'
// (case-insensitive) turn it OFF, which restores the exact pre-existing weekly cohorting behavior.
//
// This is the env-only fallback read. The effective mode now comes from the async resolver
// isSingleOpenCohortModeEnabled() in repository.ts, which prefers the persisted admin setting
// (peer_programming_settings.single_open_cohort_enabled) and only falls back to this env read when
// the admin setting is unset. Do not read PEER_PROGRAMMING_SINGLE_OPEN_COHORT anywhere except here.
export function isPeerProgrammingSingleOpenCohortEnabled(): boolean {
  const raw = process.env.PEER_PROGRAMMING_SINGLE_OPEN_COHORT;
  if (raw === undefined) {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  return normalized !== '0' && normalized !== 'false';
}
