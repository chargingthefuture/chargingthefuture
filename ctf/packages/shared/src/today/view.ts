// What the Today screen shows from a Today answer, shared by web and Android: the filter chips,
// which cards a filter and the member's hidden marks leave, and plain names for any source that
// failed to load.

import type { SeCardKind } from '../design/se-theme';
import type { SeToday, SeTodayCard, SeTodayTalk } from './types';

export type SeTodayFilter = 'all' | 'asks' | 'offers' | 'stories' | 'matches';

export type SeTodayMarks = { read: string[]; hidden: string[] };

export const SE_TODAY_FILTERS: ReadonlyArray<{ key: SeTodayFilter; label: string; kinds: SeCardKind[] | null }> = [
  { key: 'all', label: 'All', kinds: null },
  { key: 'asks', label: 'Asks', kinds: ['ask'] },
  { key: 'offers', label: 'Offers', kinds: ['offer'] },
  { key: 'stories', label: 'Stories', kinds: ['story', 'replay', 'game'] },
  { key: 'matches', label: 'Matches', kinds: ['match'] },
];

const SOURCE_NAMES: Record<string, string> = {
  'peer-programming': 'goals',
  'socket-relay': 'requests',
  'trust-transport': 'rides',
  lighthouse: 'places to stay',
  'skill-up': 'cohorts',
  announcements: 'announcements',
  'what-works': 'What Works',
  'quora-survey': 'the Quora survey',
  mood: 'Mood',
  numbers: 'numbers',
  'beacon-replays': 'replays',
  'skills-hunt': 'the Wanted card',
  'skills-hunt-mission': "today's mission",
  questions: '21 Questions',
  'blog-stories': "today's stories",
  games: "today's puzzle",
  beacon: 'the broadcast',
  chyme: 'the Main Room',
  'days-won': 'Days won',
};

export type SeTodayView = {
  cards: SeTodayCard[];
  // "Could not load goals, rides this time.", or null when every source answered.
  missingLine: string | null;
  caughtUpLine: string;
};

export function seTodayView(today: SeToday | null, marks: SeTodayMarks, filter: SeTodayFilter): SeTodayView {
  const kinds = SE_TODAY_FILTERS.find((item) => item.key === filter)?.kinds ?? null;
  const cards = (today?.cards ?? []).filter((card) => !marks.hidden.includes(card.id) && (!kinds || kinds.includes(card.kind)));
  const missing = (today?.unavailable ?? []).map((name) => SOURCE_NAMES[name] ?? name);
  return {
    cards,
    missingLine: missing.length > 0 ? `Could not load ${missing.join(', ')} this time.` : null,
    caughtUpLine: cards.length === 0 ? 'Nothing here yet.' : "You're caught up.",
  };
}

// "Today · 9:00 PM", "Tomorrow · 9:00 PM" or "Mon, Nov 2 · 9:00 PM", in the reader's own timezone.
export function seTalkWhen(startIso: string, now: Date = new Date()): string {
  const start = new Date(startIso);
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = (d: Date) => d.toDateString();
  if (day(start) === day(now)) return `Today · ${time}`;
  if (day(start) === day(new Date(now.getTime() + 86_400_000))) return `Tomorrow · ${time}`;
  return `${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

// The line under the Main Room's name: what is on, or what is next.
export function seTalkLine(talk: SeTodayTalk | null, now: Date = new Date()): string | null {
  if (!talk) return null;
  if (talk.onAir) return `On now: ${talk.title} with @${talk.host}`;
  return `Next: ${talk.title} with @${talk.host} · ${seTalkWhen(talk.startIso, now)}`;
}

// "Days the Avenhood has won": the total, and this week's share of it.
export const SE_DAYS_WON_TITLE = 'Days the Avenhood has won';
export const SE_DAYS_WON_HOW = "How it's counted";
// The blog post on why the count exists, linked from the Days won card signed in and signed out.
export const SE_DAYS_WON_WHY = {
  label: 'Why we count it',
  href: 'https://chargingthefuture.github.io/chargingthefuture/article/wiki-site/why-we-count-days-won',
};
export function seDaysWonLines(daysWon: { total: number; thisWeek: number }): { big: string; small: string; how: string } {
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return {
    big: fmt(daysWon.total),
    small: `Our progress this week: ${fmt(daysWon.thisWeek)} days won.`,
    how: "Time members spent together in rooms and calls, or helping with each other's tasks. That is less time on Specterati schemes, and more time for all of us reaching our own definition of happiness.",
  };
}
