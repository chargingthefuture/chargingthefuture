// The member's own marks on Today cards, kept on the device (per device, never on the server):
// `read` for a card marked done with its timeline dot, `hidden` for Not for me. `readOn` holds when
// each card was marked done, as a moment (marks saved on 2026-11-03 may hold the day alone).
// Owner decisions, 2026-11-03:
// - A card marked done stays on Today the day it was marked and leaves from the member's next day.
// - A story or replay marked done does not come back when the rotation brings it round again, except
//   a blog story with a new comment in its Fireside conversation since it was marked: it comes back,
//   not done, with "N new comments".
// - A card marked Not for me never comes back.
// Marks are kept across rotations, whether or not the card is on today's list.

import { seLocalDay } from '../stories/release';
import type { SeTodayCard } from './types';

export type SeTodayMarks = { read: string[]; hidden: string[]; readOn?: Record<string, string> };

const MAX_MARKS = 2000;
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(-MAX_MARKS) : [];
}

// When a mark was made, as a moment. A day alone means the start of that day, in the member's zone.
function markedMs(value: string): number {
  if (!DAY_ONLY.test(value)) return Date.parse(value);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function markedDay(value: string): string {
  return DAY_ONLY.test(value) ? value : seLocalDay(new Date(value));
}

// Marks as saved on the device, made safe to use. A done mark saved before the moment was kept counts
// as marked now, so nothing leaves Today the moment this arrives.
export function seMarksFromSaved(saved: unknown, now: Date = new Date()): SeTodayMarks {
  const raw = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const read = idList(raw.read);
  const kept = (raw.readOn && typeof raw.readOn === 'object' ? raw.readOn : {}) as Record<string, unknown>;
  const readOn: Record<string, string> = {};
  for (const id of read) {
    const value = kept[id];
    readOn[id] = typeof value === 'string' && !Number.isNaN(markedMs(value)) ? value : now.toISOString();
  }
  return { read, hidden: idList(raw.hidden), readOn };
}

// How many comments anybody can read were written under a story since the member marked it done.
export function seNewComments(marks: SeTodayMarks, card: SeTodayCard): number {
  const at = marks.read.includes(card.id) ? marks.readOn?.[card.id] : undefined;
  if (!at || !card.commentTimesIso?.length) return 0;
  const since = markedMs(at);
  return card.commentTimesIso.filter((iso) => Date.parse(iso) > since).length;
}

export function seNewCommentsLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 new comment' : `${count} new comments`;
}

// Shown as done: done on the server (a 21 Questions answer), or marked done with nothing new since.
export function seCardDone(marks: SeTodayMarks, card: SeTodayCard): boolean {
  return Boolean(card.done) || (marks.read.includes(card.id) && seNewComments(marks, card) === 0);
}

// Leaves Today: marked done on an earlier day of the member's own, with nothing new since. A card the
// server marks done is not a device mark and stays as it is.
export function seDoneBefore(marks: SeTodayMarks, card: SeTodayCard, today: string): boolean {
  if (card.done || !marks.read.includes(card.id) || seNewComments(marks, card) > 0) return false;
  const at = marks.readOn?.[card.id];
  return Boolean(at && markedDay(at) < today);
}

// The timeline dot. On a card shown as done it takes the mark away; otherwise it marks the card done
// now, which on a story that came back with new comments moves the mark to now.
export function seToggleDone(marks: SeTodayMarks, card: SeTodayCard, now: Date = new Date()): SeTodayMarks {
  if (card.done) return marks;
  const readOn = { ...(marks.readOn ?? {}) };
  if (seCardDone(marks, card)) {
    delete readOn[card.id];
    return { ...marks, read: marks.read.filter((id) => id !== card.id), readOn };
  }
  readOn[card.id] = now.toISOString();
  const read = marks.read.includes(card.id) ? marks.read : [...marks.read, card.id].slice(-MAX_MARKS);
  return { ...marks, read, readOn };
}

// Not for me: the card never comes back on this device.
export function seHideCard(marks: SeTodayMarks, cardId: string): SeTodayMarks {
  if (marks.hidden.includes(cardId)) return marks;
  return { ...marks, hidden: [...marks.hidden, cardId].slice(-MAX_MARKS) };
}
