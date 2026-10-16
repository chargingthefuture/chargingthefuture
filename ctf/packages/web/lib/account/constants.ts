// Error codes for the account-level deletion API (the cross-plugin orchestrator routes under
// `/api/account/**`). Mirrors the per-plugin `*_ERROR_CODE` constant objects used elsewhere so the
// JSON error shape is consistent across the app.

export const ACCOUNT_ERROR_CODE = {
  invalidPayload: 'ACCOUNT_INVALID_PAYLOAD',
  csrfDenied: 'ACCOUNT_CSRF_DENIED',
  serviceScopeUnsupported: 'ACCOUNT_SERVICE_SCOPE_UNSUPPORTED',
  unknownService: 'ACCOUNT_UNKNOWN_SERVICE',
  persistenceUnavailable: 'ACCOUNT_PERSISTENCE_UNAVAILABLE',
  rateLimited: 'ACCOUNT_RATE_LIMITED',
  confirmPhraseRequired: 'ACCOUNT_CONFIRM_PHRASE_REQUIRED',
} as const;

export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODE)[keyof typeof ACCOUNT_ERROR_CODE];

// The phrase a member types to confirm full-account deletion. The screen checks it before the
// button is enabled, and DELETE /api/account/full-account checks it again, so a request that did
// not come through that step (a script, a forged request riding a session) cannot delete an
// account. Android keeps its own copy in packages/mobile/src/features/account-data/glyphs.ts.
export const FULL_ACCOUNT_CONFIRM_PHRASE = 'delete my account';

/** True when `value` is the confirmation phrase, compared the way both screens compare it. */
export function isFullAccountConfirmPhrase(value: unknown): boolean {
  return typeof value === 'string' && value.toLowerCase().trim() === FULL_ACCOUNT_CONFIRM_PHRASE;
}
