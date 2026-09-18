// What a member reads on one mission card: the count, the bar width, and the two flags the card
// styles itself from. Pure — no React — so the numbers a member sees are covered by unit tests
// rather than only by looking at the screen.

import type { SkillsHuntMissionWithProgress } from './types';

export type SkillsHuntMissionView = {
  isLocked: boolean;
  color: string;
  /** The count as shown, capped at the target. */
  displayCount: number;
  /** Bar width as a percentage, already capped at 100. */
  pct: number;
  isComplete: boolean;
};

const DEFAULT_MISSION_COLOR = '#FBBF24';

export function missionView(mission: SkillsHuntMissionWithProgress): SkillsHuntMissionView {
  const progressCount = mission.progress?.progressCount ?? 0;

  // The count is capped at the target for display (owner decision 2026-09-18). A mission counting
  // more than it asked for read "82/1 complete", which looks like a fault in the bar even when the
  // number is true. Only what a member reads is capped: the stored count stays raw, so nothing is
  // lost, and the bar's width was already capped the same way — this brings the text into line
  // with the bar rather than changing either one's meaning.
  //
  // An over-count is the signature of a mission pointed at the wrong goal, and that signal is not
  // lost by capping it here. It moved to where it can be acted on: the admin Missions list names
  // what each mission counts in words, with its sector or skill beside it, so a mission counting
  // the wrong thing is legible to the person who can correct it instead of showing every member a
  // number that reads as broken.
  const displayCount = Math.min(progressCount, mission.goalTarget);

  return {
    isLocked: mission.status === 'locked',
    color: mission.colorHex ?? DEFAULT_MISSION_COLOR,
    displayCount,
    pct: Math.min(100, (progressCount / Math.max(1, mission.goalTarget)) * 100),
    // Completion is the stored moment a mission was earned, not a comparison of today's count
    // against the target. A goal narrowed after the fact does not take back what a scout earned.
    isComplete: mission.progress?.completedAtIso != null,
  };
}
