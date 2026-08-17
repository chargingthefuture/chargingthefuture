import { MUTUAL_TIME_SLOT_MINUTES, MUTUAL_TIME_SLOTS_PER_DAY } from './constants';

// Pure candidate-slot logic (no DB, no timezone assumptions) shared by the server (validation +
// result computation) and the client (rendering). A candidate slot is the UTC start of a one-hour
// meeting window, snapped to the half-hour. The full set spans window_days days — the whole 24h of
// each day, so a voter in ANY timezone can find their free hour. While a survey is open the set rolls
// forward from now (see rollingWindowStartMs); a closed survey keeps the fixed window anchored at its
// stored window_start_date. Each voter's UI renders these UTC instants in their
// own timezone; overlap is computed in UTC, which is the only tz-safe way to compare picks.

const MINUTE_MS = 60 * 1000;
const SLOT_MS = MUTUAL_TIME_SLOT_MINUTES * MINUTE_MS;

// Midnight UTC of a YYYY-MM-DD date string, as epoch ms. Parsing `${date}T00:00:00Z` avoids any local
// timezone drift (never `new Date(date)` alone, which is locale-dependent).
export function dateUtcMidnightMs(dateYmd: string): number {
  return Date.parse(`${dateYmd}T00:00:00.000Z`);
}

// The ordered list of candidate slot starts (ISO UTC strings) from a given instant. Deterministic:
// window_days × 48 half-hour starts, ascending, beginning at `startMs`.
export function generateSlotsFrom(startMs: number, windowDays: number): string[] {
  if (!Number.isFinite(startMs)) {
    return [];
  }
  const total = windowDays * MUTUAL_TIME_SLOTS_PER_DAY;
  const slots: string[] = [];
  for (let i = 0; i < total; i += 1) {
    slots.push(new Date(startMs + i * SLOT_MS).toISOString());
  }
  return slots;
}

// The first candidate start at or after `now`, snapped up to the next half-hour boundary. This is the
// anchor of the rolling window: while a survey is open the times on offer are always the next
// window_days days counted from right now, so a survey left open for a week never offers a day that
// has gone by, and nobody can pick a time in the past. The stored window_start_date only anchors a
// survey that has not opened yet or one that is already closed.
export function rollingWindowStartMs(now: Date): number {
  return Math.ceil(now.getTime() / SLOT_MS) * SLOT_MS;
}

// A Set of the candidate slots, for O(1) validation of a submitted pick. Callers should normalize an
// incoming ISO string through `normalizeSlotIso` first so equivalent instants compare equal.
export function candidateSlotSet(startMs: number, windowDays: number): Set<string> {
  return new Set(generateSlotsFrom(startMs, windowDays));
}

// Normalize any parseable ISO instant to the canonical `toISOString()` form used by the candidate
// list (so "…+00:00" vs "…Z" and millisecond variations all compare equal). Returns null if unparseable
// or not aligned to a half-hour boundary.
export function normalizeSlotIso(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    return null;
  }
  // Must fall exactly on a half-hour boundary (snapping guard) — reject arbitrary times outright.
  if (ms % SLOT_MS !== 0) {
    return null;
  }
  return new Date(ms).toISOString();
}
