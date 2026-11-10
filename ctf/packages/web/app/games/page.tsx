import type { Metadata } from 'next';
import { DailyScreen } from '../../components/se-frame/games/daily-screen';
import { DailyGateScreen } from '../../components/se-frame/games/gated-screen';
import { getHostedSignInUrl } from '../../lib/auth/provider-env';
import { readDailyGate } from '../../lib/games/play-gate';

// The puzzle of the day (3.1.0 plan, task 17). The puzzle comes from the date alone, the same for
// everyone, and the result is kept in the browser only. Playing is for any signed-in member
// (owner decision, 2026-11-10): the gate is read here, on the server, and anyone else gets the
// puzzle's details and Sign in to play, without the play screens.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Puzzle of the day · Skills Economy' };

export default async function GamesPage() {
  const { gate, reason } = await readDailyGate();
  if (gate === 'play') return <DailyScreen />;
  return <DailyGateScreen gate={gate} reason={reason} signInUrl={getHostedSignInUrl() ?? '/'} />;
}
