export const MUTUAL_TIME_PLUGIN_ID = 'mutual-time';

// The plugins a chosen meeting can point to ("Where we'll meet"). Chyme (live audio) is the default;
// PeerProgramming is the weekly mastermind call; Beacon is the live one-way broadcast. All three are
// live-meeting surfaces the result links to.
export const MUTUAL_TIME_MEETING_PLUGINS = ['chyme', 'peer-programming', 'beacon'] as const;
export type MutualTimeMeetingPlugin = (typeof MUTUAL_TIME_MEETING_PLUGINS)[number];

// Candidate-slot grid. Votes are one-hour windows whose start is snapped to the half-hour, so votes
// line up across people and half-hour timezones (e.g. India). The candidate window spans a number of
// days starting from the event's window_start_date; slots are generated, never stored.
export const MUTUAL_TIME_SLOT_MINUTES = 30; // half-hour snapping
export const MUTUAL_TIME_MEETING_MINUTES = 60; // one-hour meeting window
export const MUTUAL_TIME_DEFAULT_WINDOW_DAYS = 7;
export const MUTUAL_TIME_MAX_WINDOW_DAYS = 14;
export const MUTUAL_TIME_SLOTS_PER_DAY = (24 * 60) / MUTUAL_TIME_SLOT_MINUTES; // 48

// Each voter may pick up to this many one-hour windows. Capped low on purpose: more picks make a
// mutual time harder to find (spec #1780).
export const MUTUAL_TIME_MAX_PICKS = 3;

export const MUTUAL_TIME_MAX_TITLE_LENGTH = 120;
export const MUTUAL_TIME_MAX_DESCRIPTION_LENGTH = 500;

export const MUTUAL_TIME_ERROR_CODE = {
  invalidPayload: 'MUTUAL_TIME_INVALID_PAYLOAD',
  notFound: 'MUTUAL_TIME_NOT_FOUND',
  notOpen: 'MUTUAL_TIME_NOT_OPEN',
  tooManyPicks: 'MUTUAL_TIME_TOO_MANY_PICKS',
  invalidSlot: 'MUTUAL_TIME_INVALID_SLOT',
  persistenceUnavailable: 'MUTUAL_TIME_PERSISTENCE_UNAVAILABLE',
  internalError: 'MUTUAL_TIME_INTERNAL_ERROR',
  csrfDenied: 'MUTUAL_TIME_CSRF_DENIED',
} as const;

export type MutualTimeErrorCode = (typeof MUTUAL_TIME_ERROR_CODE)[keyof typeof MUTUAL_TIME_ERROR_CODE];
