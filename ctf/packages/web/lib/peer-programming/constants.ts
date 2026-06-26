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
export const PEER_PROGRAMMING_COHORT_TARGET_SIZE = 5;

// Label for the single standing cohort used in low-population mode.
export const PEER_PROGRAMMING_STANDING_COHORT_LABEL = 'C1';

// Single standing, always-open Cohort 1 mode (owner directive, temporary low-population mode).
// When ON there is one standing cohort (is_standing = TRUE) that any active member auto-joins on
// opening the room, the weekly auto-split is paused, and the cohort is not week-scoped. The flag
// DEFAULTS ON: unset or empty is treated as ON. Only the explicit values '0' or 'false'
// (case-insensitive) turn it OFF, which restores the exact pre-existing weekly cohorting behavior.
// This is the single resolver — do not read PEER_PROGRAMMING_SINGLE_OPEN_COHORT elsewhere.
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
