// Pieces of the 3.1 Today board (Skills Economy 3.1.0 Screens: Today, a quiet day, broadcast) shared
// by web and Android: the "N Avens here" pill, the Mood faces, the closing line under the cards and
// the line under a live broadcast's title.

import type { SeTodayBroadcast, SeTodayCard } from './types';

// Signed-in members who read Today in the last 10 minutes (member_presence). Never names. Null when
// the count could not be read, and then the pill is not shown.
export const SE_PRESENCE_WINDOW_MINUTES = 10;

export function sePresenceLine(count: number | null | undefined): string | null {
  if (count === null || count === undefined || count < 1) return null;
  return count === 1 ? '1 Aven here' : `${count.toLocaleString('en-US')} Avens here`;
}

// The Mood card's five faces, posted as the check-in's value (1 to 5) to POST /api/mood/submissions.
// `mouth` is the face's mouth in a 24 by 24 drawing, as on the board.
export const SE_TODAY_MOOD_TITLE = 'How is today?';

export const SE_TODAY_MOODS: ReadonlyArray<{ value: number; label: string; mouth: string }> = [
  { value: 1, label: 'Very hard', mouth: 'M8 16c2-2 6-2 8 0' },
  { value: 2, label: 'Hard', mouth: 'M8 15.5c2-1 6-1 8 0' },
  { value: 3, label: 'Okay', mouth: 'M8 15h8' },
  { value: 4, label: 'Good', mouth: 'M8 14.5c2 1 6 1 8 0' },
  { value: 5, label: 'Very good', mouth: 'M8 14c2 2.5 6 2.5 8 0' },
];

export const SE_TODAY_MOOD_WORDS = {
  saving: 'Saving…',
  saved: (label: string) => `Checked in: ${label}. The next check-in opens in a week.`,
  failed: 'The check-in was not saved.',
} as const;

export function seIsMoodCard(card: Pick<SeTodayCard, 'source'>): boolean {
  return card.source === 'mood';
}

// The two lines under the last card. A quiet day (nobody's ask, offer or match on the board) reads
// "That is today."; otherwise "You're caught up." The second line says how many stories open at the
// member's midnight, or that new cards arrive as people post when that number is unknown.
export function seClosingLines(cards: ReadonlyArray<Pick<SeTodayCard, 'kind' | 'mine'>>, storiesTomorrow: number | null | undefined): { title: string; note: string } {
  const busy = cards.some((card) => !card.mine && (card.kind === 'ask' || card.kind === 'offer' || card.kind === 'match'));
  const title = cards.length === 0 ? 'Nothing here yet.' : busy ? "You're caught up." : 'That is today.';
  if (!storiesTomorrow || storiesTomorrow < 1) return { title, note: 'New cards arrive as people post.' };
  const stories = storiesTomorrow === 1 ? '1 more story opens' : `${storiesTomorrow} more stories open`;
  return { title, note: `${stories} at your midnight.` };
}

// "farah · started at 6:02 PM CDT", in the reader's own time zone. Null when neither is known.
export function seBroadcastHostLine(broadcast: Pick<SeTodayBroadcast, 'host' | 'startedAtIso'>): string | null {
  const started = broadcast.startedAtIso
    ? `started at ${new Date(broadcast.startedAtIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`
    : null;
  const parts = [broadcast.host ?? null, started].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : null;
}

export const SE_BROADCAST_WORDS = {
  label: 'Broadcast',
  watch: 'Watch',
  chat: 'Chat',
  roomQuiet: 'Quiet during the broadcast',
} as const;
