import type { Metadata } from 'next';
import { DailyScreen } from '../../components/se-frame/games/daily-screen';

// The puzzle of the day (3.1.0 plan, task 17). The puzzle comes from the date alone, the same for
// everyone, so it needs no account and sends nothing; the result is kept in the browser only.

export const metadata: Metadata = { title: 'Puzzle of the day · Skills Economy' };

export default function GamesPage() {
  return <DailyScreen />;
}
