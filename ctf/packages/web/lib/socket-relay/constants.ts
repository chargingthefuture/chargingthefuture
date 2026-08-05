export const SOCKET_RELAY_DEFAULT_PAGE = 1;
export const SOCKET_RELAY_DEFAULT_PAGE_SIZE = 20;
export const SOCKET_RELAY_MAX_PAGE_SIZE = 100;
export const SOCKET_RELAY_MAX_TITLE_LENGTH = 120;
export const SOCKET_RELAY_MAX_DETAILS_LENGTH = 5000;
export const SOCKET_RELAY_MAX_MESSAGE_LENGTH = 2000;
export const SOCKET_RELAY_MAX_TAGS_PER_REQUEST = 3;
export const SOCKET_RELAY_MAX_TAG_LENGTH = 64;

// Named limit for the 400 a too-long tag gets, so a direct API caller sees what to fix instead of
// the generic "Invalid request payload." message.
export const SOCKET_RELAY_TAG_LENGTH_MESSAGE = `Each tag must be ${SOCKET_RELAY_MAX_TAG_LENGTH} characters or fewer.`;

export const SOCKET_RELAY_ERROR_CODE = {
  invalidPayload: 'SOCKET_RELAY_INVALID_PAYLOAD',
  persistenceUnavailable: 'SOCKET_RELAY_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'SOCKET_RELAY_CSRF_DENIED',
  profileNotFound: 'SOCKET_RELAY_PROFILE_NOT_FOUND',
  requestNotFound: 'SOCKET_RELAY_REQUEST_NOT_FOUND',
  fulfillmentNotFound: 'SOCKET_RELAY_FULFILLMENT_NOT_FOUND',
  notOwner: 'SOCKET_RELAY_NOT_OWNER',
  policyDenied: 'SOCKET_RELAY_POLICY_DENIED',
  requestNotClaimable: 'SOCKET_RELAY_REQUEST_NOT_CLAIMABLE',
  requestNotRepostable: 'SOCKET_RELAY_REQUEST_NOT_REPOSTABLE',
  requestExpired: 'SOCKET_RELAY_REQUEST_EXPIRED',
  actorNotRequester: 'SOCKET_RELAY_ACTOR_NOT_REQUESTER',
  fulfillmentNotActive: 'SOCKET_RELAY_FULFILLMENT_NOT_ACTIVE',
  invalidOutcome: 'SOCKET_RELAY_INVALID_OUTCOME',
  actorIsOwner: 'SOCKET_RELAY_ACTOR_IS_OWNER',
  blockedPair: 'SOCKET_RELAY_BLOCKED_PAIR',
  actorNotParticipant: 'SOCKET_RELAY_ACTOR_NOT_PARTICIPANT',
  prohibitedContent: 'SOCKET_RELAY_PROHIBITED_CONTENT',
} as const;
