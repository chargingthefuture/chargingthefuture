// Stable error/result codes for the Trust plugin API. Kept in one place so routes and the
// shared `_lib` helpers return the same machine-readable codes.

export const TRUST_ERROR_CODE = {
  invalidPayload: 'TRUST_INVALID_PAYLOAD',
  csrfDenied: 'TRUST_CSRF_DENIED',
  notFound: 'TRUST_NOT_FOUND',
  persistenceUnavailable: 'TRUST_PERSISTENCE_UNAVAILABLE',
} as const;

// The derivation model identifier persisted on every snapshot row. Bump the suffix when the set of
// real signals or how they are aggregated changes, so older snapshots stay self-describing.
export const TRUST_SNAPSHOT_MODEL = 'cross_plugin_engagement_v4';
