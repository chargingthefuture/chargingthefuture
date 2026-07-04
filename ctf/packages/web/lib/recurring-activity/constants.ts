// Stable error/result codes for the Recurring Activity plugin API. One place so routes and the shared
// `_lib` helpers return the same machine-readable codes.
export const RECURRING_ACTIVITY_ERROR_CODE = {
  invalidPayload: 'RECURRING_ACTIVITY_INVALID_PAYLOAD',
  csrfDenied: 'RECURRING_ACTIVITY_CSRF_DENIED',
  notFound: 'RECURRING_ACTIVITY_NOT_FOUND',
  forbidden: 'RECURRING_ACTIVITY_FORBIDDEN',
  conflict: 'RECURRING_ACTIVITY_CONFLICT',
  persistenceUnavailable: 'RECURRING_ACTIVITY_PERSISTENCE_UNAVAILABLE',
} as const;

// The ServiceCredits currency code (the only value type that carries a declared amount here).
export const SERVICE_CREDITS_CODE = 'SC';

// The internal, non-member-selectable counting unit each confirmed fiat recurring activity contributes
// to the Community Value Index (one RACT per activity — a count, never a fiat amount). See schema.sql.
export const RECURRING_ACTIVITY_COUNT_UNIT = 'RACT';
