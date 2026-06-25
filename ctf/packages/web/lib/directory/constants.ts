export const DIRECTORY_PLUGIN_ID = 'directory';

export const DIRECTORY_ERROR_CODE = {
  invalidPayload: 'DIRECTORY_INVALID_PAYLOAD',
  notFound: 'DIRECTORY_NOT_FOUND',
  conflict: 'DIRECTORY_CONFLICT',
  persistenceUnavailable: 'DIRECTORY_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'DIRECTORY_CSRF_DENIED',
  claimedProfileGuard: 'DIRECTORY_CLAIMED_PROFILE_GUARD',
  ownProfileRequired: 'DIRECTORY_OWN_PROFILE_REQUIRED',
} as const;

export const DIRECTORY_MAX_NAME_LENGTH = 120;
export const DIRECTORY_MAX_HEADLINE_LENGTH = 160;
export const DIRECTORY_MAX_BIO_LENGTH = 2000;
export const DIRECTORY_MAX_URL_LENGTH = 240;
export const DIRECTORY_MAX_ANNOUNCEMENT_TITLE_LENGTH = 140;
export const DIRECTORY_MAX_ANNOUNCEMENT_BODY_LENGTH = 4000;

// Free-text "skill not listed" entries a member can add to their own profile. Each saves as a
// "pending review" chip until an admin promotes it into the canonical taxonomy. Mirrors the
// SkillsHunt nomination limits (each label <= 40 chars; capped count) so the two stay consistent.
export const DIRECTORY_MAX_PROPOSED_SKILL_LENGTH = 40;
export const DIRECTORY_MAX_PROPOSED_SKILLS = 10;

export const DIRECTORY_DEFAULT_PAGE = 1;
export const DIRECTORY_DEFAULT_PAGE_SIZE = 20;
export const DIRECTORY_MAX_PAGE_SIZE = 100;
