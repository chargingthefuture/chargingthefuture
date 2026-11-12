// The member's own day on Today (3.1.0 plan, Card rules: new stories open at each member's own
// midnight). The phone or browser sends its calendar day and the moment its day began; the server
// uses them for everything that belongs to the day: the five stories, the puzzle of the day, 21
// Questions, the day's own cards and the closing "N more stories open at your midnight". Sent by
// web and Android alike, signed in or not. A day more than one off the UTC day, or a start more
// than a day and a half off, is not believed and the UTC day is used instead.

import { seDayStartIso } from './marks';
import { seLocalDay } from '../stories/release';

export type SeTodayDay = {
  // The member's calendar day, YYYY-MM-DD.
  day: string;
  // The moment that day began for them, as an ISO time; cards that belong to the day are dated to it.
  startIso: string;
};

const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

// The calendar day after `day`.
export function seNextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

// A day sent by the member, when it is a real date within one day of the UTC day; otherwise null.
export function seReadMemberDay(value: unknown, now: Date = new Date()): string | null {
  if (typeof value !== 'string' || !DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return null;
  const utc = now.toISOString().slice(0, 10);
  return Math.abs(dayNumber(value) - dayNumber(utc)) <= 1 ? value : null;
}

// A start of day sent by the member, when it is no more than an hour ahead or a day and a half behind.
export function seReadMemberDayStart(value: unknown, now: Date = new Date()): string | null {
  const at = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(at) || at > now.getTime() + DAY_MS / 24 || at < now.getTime() - 1.5 * DAY_MS) return null;
  return new Date(at).toISOString();
}

// The member's day from what the request carried, the UTC day where it carried nothing usable.
export function seReadTodayDay(input: { day?: unknown; dayStart?: unknown }, now: Date = new Date()): SeTodayDay {
  const day = seReadMemberDay(input.day, now) ?? now.toISOString().slice(0, 10);
  return { day, startIso: seReadMemberDayStart(input.dayStart, now) ?? `${day}T00:00:00.000Z` };
}

// What the screen adds to its Today read, from the phone's or browser's own clock.
export function seTodayDayQuery(now: Date = new Date()): string {
  return `dayStart=${encodeURIComponent(seDayStartIso(now))}&day=${seLocalDay(now)}`;
}
