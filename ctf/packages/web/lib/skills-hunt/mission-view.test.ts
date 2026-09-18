import { describe, expect, it } from 'vitest';
import { missionView } from './mission-view';
import type { SkillsHuntMissionWithProgress } from './types';

function mission(progressCount: number | null, goalTarget: number): SkillsHuntMissionWithProgress {
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
    progress: progressCount === null ? null : {
      id: '33333333-3333-4333-8333-333333333333',
      missionId: '11111111-1111-4111-8111-111111111111',
      userId: 'scout',
      progressCount,
      completedAtIso: progressCount >= goalTarget ? '2026-09-18T00:00:00.000Z' : null,
      metadata: {},
      updatedAtIso: '2026-09-18T00:00:00.000Z',
    },
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

  it('reads zero when no progress row exists yet', () => {
    expect(missionView(mission(null, 3)).displayCount).toBe(0);
  });

  // The bar was already capped; capping the text brings the two into line rather than changing
  // what the bar does.
  it('keeps the bar capped at full width, as before', () => {
    expect(missionView(mission(82, 1)).pct).toBe(100);
    expect(missionView(mission(1, 4)).pct).toBe(25);
  });

  // Completion is the stored moment a mission was earned. A goal narrowed later does not take back
  // what a scout earned, so this must not become a count-against-target comparison.
  it('marks completion from the stored time, not from the count', () => {
    expect(missionView(mission(82, 1)).isComplete).toBe(true);
    expect(missionView(mission(1, 3)).isComplete).toBe(false);
  });
});
