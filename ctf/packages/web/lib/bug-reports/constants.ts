// Shared constants for the in-app bug reporting feature.
//
// Users file a problem report from inside the app; the raw text is stored privately
// and never published. See rule 129 (Bug Reporting and Triage Rules) for the full
// pipeline and the reasons behind the fail-closed defaults below.

export const BUG_REPORT_ERROR_CODE = {
  csrfDenied: 'bug_reports.csrf_denied',
  invalidPayload: 'bug_reports.invalid_payload',
  rateLimited: 'bug_reports.rate_limited',
  persistenceUnavailable: 'bug_reports.persistence_unavailable',
  forbidden: 'bug_reports.forbidden',
} as const;

export type BugReportErrorCode =
  (typeof BUG_REPORT_ERROR_CODE)[keyof typeof BUG_REPORT_ERROR_CODE];

// Lifecycle of a single report. A report is born `new` (clean, eligible for an issue)
// or `held_for_review` (the sanitizer flagged it — a human must look before anything
// is published). It never auto-advances past `held_for_review`.
export const BUG_REPORT_STATUS = [
  'new',
  'held_for_review',
  'issue_created',
  'rejected',
  'resolved',
] as const;

export type BugReportStatus = (typeof BUG_REPORT_STATUS)[number];

export const BUG_REPORT_RISK_LEVEL = ['clean', 'flagged', 'unknown'] as const;

export type BugReportRiskLevel = (typeof BUG_REPORT_RISK_LEVEL)[number];

// Length caps keep a single accidental paste (or an abusive flood) from filling the
// table. The message is required; the context line is optional.
export const BUG_REPORT_MESSAGE_MAX_LENGTH = 5000;
export const BUG_REPORT_CONTEXT_MAX_LENGTH = 5000;
export const BUG_REPORT_METADATA_MAX_LENGTH = 512;

// Per-user rate limit: at most this many reports inside the rolling window. A
// non-technical user base produces accidental double-taps and frustrated retries;
// this keeps the triage queue useful rather than flooded without ever blocking a
// genuine first report.
export const BUG_REPORT_RATE_LIMIT_COUNT = 5;
export const BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES = 10;

// The private triage repository where issues are created. Configurable so the repo
// name is a one-line change, never hard-coded across the pipeline.
export function getTriageRepo(): string {
  return process.env.BUG_REPORTS_TRIAGE_REPO?.trim() || 'chargingthefuture/bug-reports';
}
