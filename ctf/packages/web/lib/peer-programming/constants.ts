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
