export const LIGHTHOUSE_DEFAULT_PAGE = 1;
export const LIGHTHOUSE_DEFAULT_PAGE_SIZE = 20;
export const LIGHTHOUSE_MAX_PAGE_SIZE = 100;

export const LIGHTHOUSE_PROFILE_TYPES = ['seeker', 'host'] as const;
export const LIGHTHOUSE_MATCH_STATUSES = ['pending', 'accepted', 'rejected', 'canceled', 'completed'] as const;

export const LIGHTHOUSE_ERROR_CODE = {
  invalidPayload: 'LIGHTHOUSE_INVALID_PAYLOAD',
  persistenceUnavailable: 'LIGHTHOUSE_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'LIGHTHOUSE_CSRF_DENIED',
  profileNotFound: 'LIGHTHOUSE_PROFILE_NOT_FOUND',
  propertyNotFound: 'LIGHTHOUSE_PROPERTY_NOT_FOUND',
  matchNotFound: 'LIGHTHOUSE_MATCH_NOT_FOUND',
  notOwner: 'LIGHTHOUSE_NOT_OWNER',
  policyDenied: 'LIGHTHOUSE_POLICY_DENIED',
  duplicateMatch: 'LIGHTHOUSE_DUPLICATE_MATCH',
  blockedPair: 'LIGHTHOUSE_BLOCKED_PAIR',
  announcementInvalidTargeting: 'LIGHTHOUSE_ANNOUNCEMENT_INVALID_TARGETING',
} as const;
