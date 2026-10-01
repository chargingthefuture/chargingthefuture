import { describe, expect, it } from 'vitest';
import { splitAwardPool } from './round-awards';

const standings = [
  { userId: 'a', username: 'a', score: 60 },
  { userId: 'b', username: 'b', score: 30 },
  { userId: 'c', username: 'c', score: 10 },
];

describe('splitAwardPool', () => {
  it('shares the pool by points among scouts at or above the bar', () => {
    expect(splitAwardPool(standings, 30, 90)).toEqual([
      { userId: 'a', username: 'a', score: 60, amount: 60 },
      { userId: 'b', username: 'b', score: 30, amount: 30 },
    ]);
  });

  it('rounds each share down so the total never exceeds the pool', () => {
    const shares = splitAwardPool(standings, 0, 10);
    expect(shares.map((s) => s.amount)).toEqual([6, 3, 1]);
    const uneven = splitAwardPool([{ userId: 'x', username: null, score: 1 }, { userId: 'y', username: null, score: 2 }], 0, 10);
    expect(uneven.map((s) => s.amount)).toEqual([3, 6]);
    expect(uneven.reduce((sum, s) => sum + s.amount, 0)).toBeLessThanOrEqual(10);
  });

  it('leaves out a scout whose share rounds to nothing', () => {
    expect(splitAwardPool(standings, 0, 5).map((s) => s.userId)).toEqual(['a', 'b']);
  });

  it('awards nobody when nobody reaches the bar, the pool is empty, or every score is zero', () => {
    expect(splitAwardPool(standings, 100, 90)).toEqual([]);
    expect(splitAwardPool(standings, 0, 0)).toEqual([]);
    expect(splitAwardPool([{ userId: 'z', username: null, score: 0 }], 0, 50)).toEqual([]);
  });
});
