import { seDailyGateFor, type SeDailyGate } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';

// Whether this request may play the puzzle of the day (owner decision, 2026-11-10): any signed-in
// member, approved or not, under "3.1 open sign-up use" at the 'signed_in' tier, so account
// restrictions still apply. The /games page asks this on the server and sends the play screens only
// for 'play'; a visitor who is not signed in gets the puzzle's details and Sign in to play.

export const DAILY_PLAY_ACCESS = { minUnlockTier: 'signed_in' } as const;

export type DailyGateRead = { gate: SeDailyGate; reason: string | null };

export async function readDailyGate(): Promise<DailyGateRead> {
  try {
    return { gate: seDailyGateFor(await evaluatePluginAccess(DAILY_PLAY_ACCESS)), reason: null };
  } catch (error) {
    reportError(error, { area: 'games', op: 'play_gate' });
    return { gate: 'unavailable', reason: failureReason(error) };
  }
}
