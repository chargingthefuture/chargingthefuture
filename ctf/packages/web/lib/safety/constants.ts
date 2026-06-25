// Shared constants for the member safety-report escalation (issue #809, task 3).
//
// A safety report is the only path by which a member block reaches the admin. An ordinary block is
// private and the admin never sees it; a block flagged as a safety concern ("suspected predator /
// human trafficker") also writes a member_safety_reports row, which the admin reviews and acts on.
// The global ban the admin performs in response is a separate, later task (task 5).

export const SAFETY_ERROR_CODE = {
  invalidPayload: 'SAFETY_INVALID_PAYLOAD',
  csrfDenied: 'SAFETY_CSRF_DENIED',
  persistenceUnavailable: 'SAFETY_PERSISTENCE_UNAVAILABLE',
  forbidden: 'SAFETY_FORBIDDEN',
} as const;

export type SafetyErrorCode = (typeof SAFETY_ERROR_CODE)[keyof typeof SAFETY_ERROR_CODE];

// Lifecycle of a single safety report. New reports are `open`; the admin moves one to `reviewed`
// (looked at / acted on) or `dismissed` (not a real safety concern). It never auto-advances.
export const SAFETY_REPORT_STATUS = ['open', 'reviewed', 'dismissed'] as const;

export type SafetyReportStatus = (typeof SAFETY_REPORT_STATUS)[number];

// Cap on the optional free-text context. One paragraph is enough for "anything the admins should
// know"; a cap keeps a single accidental paste from filling the table.
export const SAFETY_REPORT_DETAIL_MAX_LENGTH = 2000;
