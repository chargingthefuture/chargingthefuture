import { describe, it, expect } from 'vitest';
import { findFastConfirmations, findReciprocalPairs, findTightClusters } from './review';
import { CADENCE_MONTHLY_FACTOR, cadenceMonthlyFactorSql } from './types';

// The review decides whether a group of members gets a second look from a person, so a wrong flag has
// a real cost in both directions: a missed ring, or a neighborhood wrongly singled out. The graph
// logic is pure, so it is worth pinning exactly.

const at = (iso: string) => new Date(iso);

function edge(owner: string, counterparty: string, created = '2026-01-01T00:00:00Z', confirmed: string | null = '2026-01-02T00:00:00Z') {
  return {
    activityId: `${owner}-${counterparty}`,
    ownerUserId: owner,
    counterpartyUserId: counterparty,
    createdAt: at(created),
    confirmedAt: confirmed ? at(confirmed) : null,
  };
}

describe('findReciprocalPairs', () => {
  it('flags two members who each declared one with the other', () => {
    const pairs = findReciprocalPairs([edge('a', 'b'), edge('b', 'a')]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].activityIds).toHaveLength(2);
  });

  it('leaves a single arrangement between two people alone', () => {
    expect(findReciprocalPairs([edge('a', 'b')])).toEqual([]);
  });

  it('reports a pair once, whichever way round it was declared', () => {
    const pairs = findReciprocalPairs([edge('b', 'a'), edge('a', 'b'), edge('c', 'd')]);
    expect(pairs).toHaveLength(1);
    expect([pairs[0].userA, pairs[0].userB].sort()).toEqual(['a', 'b']);
  });
});

describe('findFastConfirmations', () => {
  it('flags a confirmation inside a minute', () => {
    const fast = findFastConfirmations([
      edge('a', 'b', '2026-01-01T00:00:00Z', '2026-01-01T00:00:20Z'),
    ]);
    expect(fast).toHaveLength(1);
    expect(fast[0].secondsToConfirm).toBe(20);
  });

  it('leaves a considered confirmation alone', () => {
    expect(findFastConfirmations([edge('a', 'b', '2026-01-01T00:00:00Z', '2026-01-01T02:00:00Z')])).toEqual([]);
  });

  it('ignores a negative gap rather than reporting a nonsense number', () => {
    // Clocks disagreeing is not someone being quick.
    expect(findFastConfirmations([edge('a', 'b', '2026-01-01T00:01:00Z', '2026-01-01T00:00:00Z')])).toEqual([]);
  });
});

describe('findTightClusters', () => {
  it('flags a small group whose arrangements loop back on each other', () => {
    // a–b–c–a: three members, three arrangements.
    const clusters = findTightClusters([edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].memberUserIds).toEqual(['a', 'b', 'c']);
    expect(clusters[0].density).toBe(1);
  });

  it('leaves a chain of introductions alone', () => {
    // a–b–c: three members, two arrangements. No loop, so nobody confirmed back.
    expect(findTightClusters([edge('a', 'b'), edge('b', 'c')])).toEqual([]);
  });

  it('leaves a group larger than eight alone — that is a community, not a ring', () => {
    const members = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'];
    const ring = members.map((m, i) => edge(m, members[(i + 1) % members.length]));
    expect(findTightClusters(ring)).toEqual([]);
  });

  it('leaves a single pair alone — two people are not a group', () => {
    expect(findTightClusters([edge('a', 'b'), edge('b', 'a')])).toEqual([]);
  });
});

describe('cadence normalization', () => {
  it('puts a weekly and a monthly arrangement on the same yearly footing', () => {
    // 50 credits a week over a year is 52 * 50; the monthly figure must reflect that, not 50.
    expect(50 * CADENCE_MONTHLY_FACTOR.weekly * 12).toBeCloseTo(50 * 52, 6);
    expect(50 * CADENCE_MONTHLY_FACTOR.monthly * 12).toBeCloseTo(50 * 12, 6);
    expect(50 * CADENCE_MONTHLY_FACTOR.quarterly * 12).toBeCloseTo(50 * 4, 6);
    expect(50 * CADENCE_MONTHLY_FACTOR.biweekly * 12).toBeCloseTo(50 * 26, 6);
  });

  it('builds SQL that covers every cadence and falls back rather than dropping a row', () => {
    const sql = cadenceMonthlyFactorSql();
    for (const cadence of Object.keys(CADENCE_MONTHLY_FACTOR)) {
      expect(sql).toContain(`WHEN '${cadence}'`);
    }
    expect(sql).toContain('ELSE 1 END');
  });
});
