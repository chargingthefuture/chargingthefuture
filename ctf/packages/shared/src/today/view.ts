// What the Today screen shows from a Today answer, shared by web and Android: the filter chips,
// which cards a filter and the member's hidden marks leave, the done count, and plain names for any
// source that failed to load.

import type { SeCardKind } from '../design/se-theme';
import type { SeToday, SeTodayCard, SeTodayTalk } from './types';

export type SeTodayFilter = 'all' | 'asks' | 'offers' | 'stories' | 'matches';

export type SeTodayMarks = { read: string[]; hidden: string[] };

export const SE_TODAY_FILTERS: ReadonlyArray<{ key: SeTodayFilter; label: string; kinds: SeCardKind[] | null }> = [
  { key: 'all', label: 'All', kinds: null },
  { key: 'asks', label: 'Asks', kinds: ['ask'] },
  { key: 'offers', label: 'Offers', kinds: ['offer'] },
  { key: 'stories', label: 'Stories', kinds: ['story', 'replay'] },
  { key: 'matches', label: 'Matches', kinds: ['match'] },
];

const SOURCE_NAMES: Record<string, string> = {
  'peer-programming': 'goals',
  'socket-relay': 'requests',
  'trust-transport': 'rides',
  lighthouse: 'places to stay',
  'skill-up': 'cohorts',
  announcements: 'announcements',
  'directory-invites': 'invitations',
  'what-works': 'What Works',
  'quora-survey': 'the Quora survey',
  mood: 'Mood',
  numbers: 'numbers',
  'beacon-replays': 'replays',
  'skills-hunt': 'the Wanted card',
  'skills-hunt-mission': "today's mission",
  beacon: 'the broadcast',
  chyme: 'the Main Room',
};

export type SeTodayView = {
  cards: SeTodayCard[];
  // Hidden until the member has opened one card: null means show nothing.
  doneLine: string | null;
  // "Could not load goals, rides this time.", or null when every source answered.
  missingLine: string | null;
  caughtUpLine: string;
};

export function seTodayView(today: SeToday | null, marks: SeTodayMarks, filter: SeTodayFilter): SeTodayView {
  const kinds = SE_TODAY_FILTERS.find((item) => item.key === filter)?.kinds ?? null;
  const cards = (today?.cards ?? []).filter((card) => !marks.hidden.includes(card.id) && (!kinds || kinds.includes(card.kind)));
  const done = cards.filter((card) => marks.read.includes(card.id)).length;
  const missing = (today?.unavailable ?? []).map((name) => SOURCE_NAMES[name] ?? name);
  return {
    cards,
    doneLine: done > 0 ? `${done} of ${cards.length} done` : null,
    missingLine: missing.length > 0 ? `Could not load ${missing.join(', ')} this time.` : null,
    caughtUpLine: cards.length === 0 ? 'Nothing here yet.' : "You're caught up.",
  };
}

export function seRoomPeopleLine(members: number, guests: number): string {
  if (members + guests === 0) return 'Quiet right now';
  return `${members} in the room${guests ? `, ${guests} listening as guests` : ''}`;
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
