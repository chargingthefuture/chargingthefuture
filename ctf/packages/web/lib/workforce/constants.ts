export const WORKFORCE_PLUGIN_ID = 'workforce';

export const WORKFORCE_ERROR_CODE = {
  invalidPayload: 'WORKFORCE_INVALID_PAYLOAD',
  notFound: 'WORKFORCE_NOT_FOUND',
  conflict: 'WORKFORCE_CONFLICT',
  persistenceUnavailable: 'WORKFORCE_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'WORKFORCE_CSRF_DENIED',
  invalidSyncToken: 'WORKFORCE_INVALID_SYNC_TOKEN',
  exportDeferred: 'WORKFORCE_EXPORT_DEFERRED',
} as const;

export const WORKFORCE_DEFAULT_PAGE = 1;
export const WORKFORCE_DEFAULT_PAGE_SIZE = 20;
export const WORKFORCE_MAX_PAGE_SIZE = 100;

export const WORKFORCE_MAX_ANNOUNCEMENT_TITLE_LENGTH = 160;
export const WORKFORCE_MAX_ANNOUNCEMENT_BODY_LENGTH = 4000;
export const WORKFORCE_MAX_OCCUPATION_NAME_LENGTH = 120;
export const WORKFORCE_MAX_REGION_LENGTH = 80;

export const WORKFORCE_DEFAULT_TIMEZONE = 'America/New_York';
export const WORKFORCE_DEFAULT_WEEK_START_DOW = 6;

// Allowed export dataset types for workforce export jobs. These mirror the report drill-down
// surfaces the plugin can produce: an overall summary, a skill-level breakdown, and a sector
// breakdown. The export POST route rejects any other value; the command contract inputSchema
// (WORKFORCE_PLUGIN_COMMAND_CONTRACTS.yaml, workforce.export.job.create) lists the same enum so
// code and contract agree.
export const WORKFORCE_EXPORT_TYPES = ['summary', 'skill-level', 'sector'] as const;
export type WorkforceExportType = (typeof WORKFORCE_EXPORT_TYPES)[number];

export function isWorkforceExportType(value: unknown): value is WorkforceExportType {
  return typeof value === 'string' && (WORKFORCE_EXPORT_TYPES as readonly string[]).includes(value);
}
