import { seDailyGateFor, type SeDailyGate } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';

// Whether this request may play the puzzle of the day (owner decision, 2026-11-10): approved members
// only, the default Unlock tier, with no exception. The /games page asks this on the server and sends
// the play screens only for 'play'; everyone else gets the puzzle's details and what to do next.

export type DailyGateRead = { gate: SeDailyGate; reason: string | null };

export async function readDailyGate(): Promise<DailyGateRead> {
  try {
    return { gate: seDailyGateFor(await evaluatePluginAccess()), reason: null };
  } catch (error) {
    reportError(error, { area: 'games', op: 'play_gate' });
    return { gate: 'unavailable', reason: failureReason(error) };
  }
}
