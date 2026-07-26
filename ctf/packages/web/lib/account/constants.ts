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
} as const;

export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODE)[keyof typeof ACCOUNT_ERROR_CODE];
