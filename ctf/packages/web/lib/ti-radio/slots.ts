import {
  TI_RADIO_GUIDE_DAYS,
  TI_RADIO_MAX_SLOTS_PER_DAY,
  TI_RADIO_ROLLING_WINDOW_HOURS,
  TI_RADIO_SLOT_MINUTES,
  TI_RADIO_SLOTS_PER_DAY,
} from './constants';

// The grid and the booking ceiling, as pure functions with no database and no timezone assumptions.
// The server validates against these and the page renders from them, so what a member is shown, what
// the server accepts, and what the guide prints are the same set by construction rather than by two
// pieces of code agreeing.

const MINUTE_MS = 60 * 1000;
export const TI_RADIO_SLOT_MS = TI_RADIO_SLOT_MINUTES * MINUTE_MS;
const ROLLING_WINDOW_MS = TI_RADIO_ROLLING_WINDOW_HOURS * 60 * MINUTE_MS;

/**
 * The first grid start at or after `now`. Every start sits on a 90-minute boundary counted from the
 * Unix epoch, which is midnight UTC, so the same sixteen starts repeat every day forever.
 */
export function nextSlotStartMs(now: Date): number {
  return Math.ceil(now.getTime() / TI_RADIO_SLOT_MS) * TI_RADIO_SLOT_MS;
}

/** The grid start of the 90 minutes that contain `now` (the slot on air, if one is booked). */
export function currentSlotStartMs(now: Date): number {
  return Math.floor(now.getTime() / TI_RADIO_SLOT_MS) * TI_RADIO_SLOT_MS;
}

/**
 * Every slot start the guide shows, ascending, as ISO UTC strings. Starts at the slot on air rather
 * than the next one so a discussion happening right now is still on the page — a guide that drops
 * the current programme the moment it begins is the one thing a guide must not do.
 */
export function guideSlotStarts(now: Date, days: number = TI_RADIO_GUIDE_DAYS): string[] {
  const startMs = currentSlotStartMs(now);
  const total = days * TI_RADIO_SLOTS_PER_DAY;
  const out: string[] = [];
  for (let i = 0; i < total; i += 1) {
    out.push(new Date(startMs + i * TI_RADIO_SLOT_MS).toISOString());
  }
  return out;
}

/**
 * Normalize any parseable instant to the canonical ISO form used by the grid, or null when it is
 * unparseable or does not land exactly on a 90-minute boundary. An arbitrary time is rejected here
 * rather than rounded, because silently moving somebody's booking by an hour is worse than refusing it.
 */
export function normalizeSlotIso(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms) || ms % TI_RADIO_SLOT_MS !== 0) {
    return null;
  }
  return new Date(ms).toISOString();
}

/** Whether a slot start falls inside the window the guide currently covers. */
export function isWithinGuideWindow(slotMs: number, now: Date, days: number = TI_RADIO_GUIDE_DAYS): boolean {
  const startMs = currentSlotStartMs(now);
  return slotMs >= startMs && slotMs < startMs + days * TI_RADIO_SLOTS_PER_DAY * TI_RADIO_SLOT_MS;
}

/**
 * Whether adding `candidateMs` to the slots a member already holds would put more than the cap
 * inside some 24-hour stretch.
 *
 * Only windows that contain the new slot can be the ones that break, since the existing set was
 * within the cap before, and any such window can be slid until it begins on one of the member's own
 * slot starts without losing anything. So checking each start from `candidate - 24h` forward as the
 * left edge of a window covers every case, and the check is exact rather than a near-enough
 * approximation of "three a day".
 */
export function exceedsRollingCap(
  existingStartsMs: readonly number[],
  candidateMs: number,
  cap: number = TI_RADIO_MAX_SLOTS_PER_DAY,
): boolean {
  const all = [...existingStartsMs, candidateMs].sort((a, b) => a - b);
  for (const edge of all) {
    if (edge > candidateMs || edge <= candidateMs - ROLLING_WINDOW_MS) {
      continue;
    }
    const inWindow = all.filter((ms) => ms >= edge && ms < edge + ROLLING_WINDOW_MS).length;
    if (inWindow > cap) {
      return true;
    }
  }
  return false;
}
