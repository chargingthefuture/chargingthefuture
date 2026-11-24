import { describe, expect, it } from 'vitest';
import { readSnapshot, scoredMemberGaps, type ScoredMember } from './scored-members';

const gates = { threshold: 100, minAccountAgeDays: 90, minDistinctPlugins: 3, minCounterparties: 5 };

function member(overrides: Partial<ScoredMember>): ScoredMember {
  return {
    userId: 'u1',
    username: null,
    score: 0,
    accountAgeDays: 0,
    distinctPlugins: 0,
    counterparties: 0,
    eligible: false,
    computedAt: null,
    ...overrides,
  };
}

describe('scoredMemberGaps', () => {
  it('reports how far each reading is from its setting', () => {
    const gaps = scoredMemberGaps(member({ score: 76, accountAgeDays: 120, distinctPlugins: 1, counterparties: 0 }), gates);
    expect(gaps).toEqual({ pointsShort: 24, daysShort: 0, pluginsShort: 2, counterpartiesShort: 5 });
  });

  it('keeps an unknown first sign-in as unknown', () => {
    expect(scoredMemberGaps(member({ score: 10, accountAgeDays: null }), gates).daysShort).toBeNull();
  });

  it('rounds fractional scores to one place', () => {
    expect(scoredMemberGaps(member({ score: 99.5 }), gates).pointsShort).toBe(0.5);
  });
});

describe('readSnapshot', () => {
  it('reads the stored fields', () => {
    expect(readSnapshot({ score: 76, accountAgeDays: 200, distinctPlugins: 2, counterparties: 1 })).toEqual({
      score: 76,
      accountAgeDays: 200,
      distinctPlugins: 2,
      counterparties: 1,
    });
  });

  it('falls back on a missing or broken snapshot', () => {
    expect(readSnapshot(null)).toEqual({ score: 0, accountAgeDays: null, distinctPlugins: 0, counterparties: 0 });
  });
});
