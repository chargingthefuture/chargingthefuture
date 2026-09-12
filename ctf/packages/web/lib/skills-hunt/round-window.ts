import type { SkillsHuntRound, SkillsHuntRoundStatus } from './types';

// Whether a round will take a nomination right now. Two things have to hold: an admin set the
// round's status to 'active', and the clock sits inside the round's own start and end dates.
//
// This exists because those two conditions were checked in two places that disagreed. The rounds
// list filtered on the status column alone, so a round whose end date had passed still came back
// as active and the Scout tab drew a working nomination form over it. The submit guard checked the
// dates as well and refused every one of those nominations with "Round is not currently active."
// Nothing moves the status column when a round's end date passes — only an admin edit closes a
// round — so the form stayed broken from the day the window shut until somebody reported it.
//
// Both sides call this now, so the form cannot offer what the server is going to refuse.
export function isRoundAcceptingSubmissions(input: {
  status: SkillsHuntRoundStatus;
  startsAtMs: number;
  endsAtMs: number;
  nowMs?: number;
}): boolean {
  if (input.status !== 'active') {
    return false;
  }

  // An unparseable date is treated as shut rather than open. A round nobody can nominate into is a
  // visible problem an admin can fix; one that takes nominations the server will reject is not.
  if (!Number.isFinite(input.startsAtMs) || !Number.isFinite(input.endsAtMs)) {
    return false;
  }

  const now = input.nowMs ?? Date.now();
  return now >= input.startsAtMs && now <= input.endsAtMs;
}

// The same question asked of the round shape the browser holds, which carries its dates as ISO
// strings rather than as a Date.
export function isRoundOpenForNominations(round: SkillsHuntRound | null, nowMs?: number): boolean {
  if (!round) {
    return false;
  }

  return isRoundAcceptingSubmissions({
    status: round.status,
    startsAtMs: new Date(round.startsAtIso).getTime(),
    endsAtMs: new Date(round.endsAtIso).getTime(),
    nowMs,
  });
}
