import { SE_DAILY_TITLES, seDailyPuzzle, type SeTodayCard, type SeTodayDay } from '@ctf/shared';
import { action, card, utcTodayDay } from './card';

// The daily puzzle on Today (3.1.0 plan, task 17): one card for the day's puzzle, the same for
// everyone, opening /games. Nothing is read: the puzzle comes from the day alone.

export async function dailyPuzzleCard(day: SeTodayDay = utcTodayDay()): Promise<SeTodayCard[]> {
  const createdAtIso = day.startIso;
  const puzzle = seDailyPuzzle(day.day);
  const words = SE_DAILY_TITLES[puzzle.kind];
  return [
    card({
      source: 'games',
      sourceId: puzzle.day,
      kind: 'game',
      label: `Puzzle of the day · No. ${puzzle.number}`,
      title: words.title,
      body: 'About a minute. The same puzzle for everyone today, and a new one tomorrow.',
      createdAtIso,
      href: '/games',
      actions: [action('open', 'Play', '/games')],
    }),
  ];
}
