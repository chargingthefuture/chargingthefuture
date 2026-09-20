import { describe, expect, it } from 'vitest';
import { missionView } from './mission-view';
import type { SkillsHuntMissionWithCommunityProgress } from './types';

// The numbers on a mission card are the round's, across everybody (owner directive, 2026-09-20),
// so these cases are written in those terms: how many accepted nominations the community has
// against what the mission asked for.
function mission(count: number, goalTarget: number, contributors = 1): SkillsHuntMissionWithCommunityProgress {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    roundId: '22222222-2222-4222-8222-222222222222',
    title: 'Find a mechanic',
    description: null,
    goalType: 'count_skill_matches',
    goalTarget,
    goalMetadata: { skillName: 'Automotive repair' },
    bonusPoints: 5,
    colorHex: null,
    status: 'active',
    displayOrder: 0,
    autoCreated: false,
    sourceSector: null,
    sourceGapAtCreation: null,
    createdByUserId: 'admin',
    updatedByUserId: 'admin',
    createdAtIso: '2026-09-18T00:00:00.000Z',
    updatedAtIso: '2026-09-18T00:00:00.000Z',
    community: { count, contributors },
  };
}

describe('missionView — the count a member reads', () => {
  // Owner decision 2026-09-18, from the numbers in the report: a mission counting past its target
  // read "82/1 complete", which looks like a fault in the bar even when the number is true.
  it('caps the displayed count at the target', () => {
    expect(missionView(mission(82, 1)).displayCount).toBe(1);
    expect(missionView(mission(82, 3)).displayCount).toBe(3);
  });

  it('leaves a count below the target alone', () => {
    expect(missionView(mission(1, 3)).displayCount).toBe(1);
  });

  it('reads zero when the round has nothing against the mission yet', () => {
    expect(missionView(mission(0, 3, 0)).displayCount).toBe(0);
  });

  // The bar was already capped; capping the text brings the two into line rather than changing
  // what the bar does.
  it('keeps the bar capped at full width, as before', () => {
    expect(missionView(mission(82, 1)).pct).toBe(100);
    expect(missionView(mission(1, 4)).pct).toBe(25);
  });

  // Community completion is the round reaching the target between everybody, so it is a comparison
  // rather than a stored moment: nothing records when a round crossed the line, and raising the
  // target means the community has more to do again. A scout's own earned bonus is a different
  // thing entirely — the stored completed_at on their own row — and is untouched by this.
  it('marks completion when the round reaches the target, not one member', () => {
    expect(missionView(mission(3, 3)).isComplete).toBe(true);
    expect(missionView(mission(82, 1)).isComplete).toBe(true);
    expect(missionView(mission(2, 3)).isComplete).toBe(false);
    expect(missionView(mission(0, 3, 0)).isComplete).toBe(false);
  });

  // The same mission read by two different members has to give the same card, which is the point
  // of the change: it is a competition the round runs together, not a private scorecard.
  it('does not vary by who is reading it', () => {
    const asRead = missionView(mission(2, 3, 2));
    expect(asRead.displayCount).toBe(2);
    expect(asRead.isComplete).toBe(false);
  });
});
