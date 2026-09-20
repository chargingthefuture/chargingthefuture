// TI Radio — a published schedule of live discussions members host in Chyme.
//
// "TI" is Targeted Individual, the word the people this app serves use for themselves. The name
// matches the Quora space the schedule is written for (tiradio.quora.com), where the owner points
// people at a time and says come talk.
//
// The shape is a broadcast guide, not an invitation list. A guide is readable by anyone walking
// past — that is what makes it worth printing — so the page is open with no account at all. Taking
// a slot is the opposite: it puts a member's name on a time in public, and that needs Unlock
// approval like everything else in this app.
//
// Mutual Time is a different thing and stays admin-only. There the owner asks a group when they can
// meet and the app picks the hour with the most overlap. Here nobody is asked anything: a member
// claims an empty 90 minutes, says what it is about, and whoever wants it shows up.

export const TI_RADIO_PLUGIN_ID = 'ti-radio';

// Every slot is 90 minutes, and 90 divides the day exactly 16 times, so the grid is a fixed set of
// starts anchored at midnight UTC with no remainder and no drift. A fixed grid is what makes the
// page read as a guide: the same rows every day, some filled and some empty.
export const TI_RADIO_SLOT_MINUTES = 90;
export const TI_RADIO_SLOTS_PER_DAY = (24 * 60) / TI_RADIO_SLOT_MINUTES; // 16

// How far ahead the guide runs. A week is long enough to plan around and short enough that the page
// is still a list rather than a calendar application.
export const TI_RADIO_GUIDE_DAYS = 7;

// How many slots one member may hold inside any 24-hour stretch of the guide. Not a judgment about
// anybody — a ceiling so one person cannot take a whole day and leave the guide looking like one
// show. Checked against every 24-hour window that contains the slot being booked, not against the
// calendar day, so three slots at 11pm and one at 1am is the same thing as four in an evening.
export const TI_RADIO_MAX_SLOTS_PER_DAY = 3;
export const TI_RADIO_ROLLING_WINDOW_HOURS = 24;

export const TI_RADIO_MAX_TITLE_LENGTH = 120;
export const TI_RADIO_MIN_TITLE_LENGTH = 3;
export const TI_RADIO_MAX_DESCRIPTION_LENGTH = 500;
export const TI_RADIO_MAX_REMOVAL_REASON_LENGTH = 300;

// Where the discussion happens. The guide says when; Chyme is the room.
export const TI_RADIO_MEETING_ROUTE = '/apps/chyme';

export const TI_RADIO_ERROR_CODE = {
  invalidPayload: 'ti_radio_invalid_payload',
  notFound: 'ti_radio_not_found',
  forbidden: 'ti_radio_forbidden',
  slotTaken: 'ti_radio_slot_taken',
  slotPast: 'ti_radio_slot_past',
  dailyLimit: 'ti_radio_daily_limit',
  csrfDenied: 'ti_radio_csrf_denied',
  persistenceUnavailable: 'ti_radio_persistence_unavailable',
  internalError: 'ti_radio_internal_error',
} as const;

export type TiRadioErrorCode = (typeof TI_RADIO_ERROR_CODE)[keyof typeof TI_RADIO_ERROR_CODE];
