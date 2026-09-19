// Stream Video quota: the numbers the meter and the room caps read.
//
// Every value here is a plain default that an environment variable can override, so the ceiling and
// the caps live in config rather than in code (rule 110). Nothing has to be set for the app to run:
// the defaults are the Maker-tier ceiling and caps sized to it. The keys are documented in
// `.claude/rules/123-environment-configuration-rules.mdc`.

// The Maker tier's monthly Video allowance (rule 110: 333,000 participant-minutes, non-burstable).
const DEFAULT_VIDEO_MINUTES_BUDGET = 333_000;

// How many members may be in one Chyme room at once. One member holding the room open around the
// clock costs 1,440 minutes a day, so the ceiling above holds about 7.7 people continuously all
// month; a cap of 50 is a brake on a crowded hour, not the budget itself.
const DEFAULT_MAX_PARTICIPANTS = 50;

// How many signed-out listeners may be in the public room at once. Guests are the unauthenticated
// path (anyone on the internet who opens the page while a member is live), so they get their own
// cap and are the first thing the policy pauses.
const DEFAULT_MAX_GUEST_LISTENERS = 100;

// The member cap once the meter reads Red: baseline chat and the room itself stay up for a few
// people rather than the room going dark for everyone.
const DEFAULT_RED_BAND_MAX_PARTICIPANTS = 10;

// Rule 110's four bands, as the percent of the monthly budget already used.
export const STREAM_QUOTA_BAND_THRESHOLDS = { yellow: 70, orange: 85, red: 95 } as const;

export type StreamQuotaBand = 'green' | 'yellow' | 'orange' | 'red';

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Read at call time rather than module load so a test (or a rolling deploy) sees the live value.
export function streamVideoMinutesBudget(): number {
  return readPositiveInt('STREAM_VIDEO_MINUTES_BUDGET', DEFAULT_VIDEO_MINUTES_BUDGET);
}

export function chymeMaxParticipants(): number {
  return readPositiveInt('CHYME_MAX_PARTICIPANTS', DEFAULT_MAX_PARTICIPANTS);
}

export function chymeMaxGuestListeners(): number {
  return readPositiveInt('CHYME_MAX_GUEST_LISTENERS', DEFAULT_MAX_GUEST_LISTENERS);
}

export function chymeRedBandMaxParticipants(): number {
  return readPositiveInt('CHYME_RED_BAND_MAX_PARTICIPANTS', DEFAULT_RED_BAND_MAX_PARTICIPANTS);
}

export function streamQuotaBandFor(percentUsed: number): StreamQuotaBand {
  if (percentUsed >= STREAM_QUOTA_BAND_THRESHOLDS.red) return 'red';
  if (percentUsed >= STREAM_QUOTA_BAND_THRESHOLDS.orange) return 'orange';
  if (percentUsed >= STREAM_QUOTA_BAND_THRESHOLDS.yellow) return 'yellow';
  return 'green';
}

// The surfaces the meter distinguishes. A Chyme room is metered under its room key (the open main
// room and the private Weavers room separately); guests and Back Channel calls are their own lines.
export const STREAM_VIDEO_SURFACE = {
  chymeGuest: 'chyme:guest',
  chymeBackChannel: 'chyme:back-channel',
} as const;

export function chymeRoomSurface(roomKey: string): string {
  return `chyme:${roomKey}`;
}
