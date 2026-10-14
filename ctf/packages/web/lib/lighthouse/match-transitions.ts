import type { LighthouseMatch } from './types';

type MatchStatus = LighthouseMatch['status'];

// The moves a host or seeker may make on a match, keyed by the status the match is in now. A
// request the seeker withdrew, or one the host already declined, is finished: nobody but an admin
// can bring it back, because reopening it would open chat for somebody who walked away and add a
// stay to the Trust and GDP counts that never happened. A stay is marked completed only after it
// was accepted, for the same reason.
const HOST_MOVES: Partial<Record<MatchStatus, readonly MatchStatus[]>> = {
  pending: ['accepted', 'rejected'],
  accepted: ['completed'],
};

const SEEKER_MOVES: Partial<Record<MatchStatus, readonly MatchStatus[]>> = {
  pending: ['canceled'],
  accepted: ['canceled'],
};

export function isAllowedMatchTransition(
  side: 'host' | 'seeker',
  from: MatchStatus,
  to: MatchStatus,
): boolean {
  const moves = side === 'host' ? HOST_MOVES : SEEKER_MOVES;
  return moves[from]?.includes(to) ?? false;
}
