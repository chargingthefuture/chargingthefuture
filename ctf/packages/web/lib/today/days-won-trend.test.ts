import { describe, expect, it } from 'vitest';
import { seDaysWonSeenOn, seDaysWonTrend, seGuestDaysWon } from '@ctf/shared';

describe('Days won week line', () => {
  it('climbs day by day and ends at the top right', () => {
    const trend = seDaysWonTrend([0, 1, 0, 2, 1, 0, 1], 66, 26, 3);
    expect(trend?.points.split(' ')).toHaveLength(7);
    expect(trend?.points.startsWith('3,23')).toBe(true);
    expect(trend?.end).toEqual({ x: 63, y: 3 });
  });

  it('lies flat along the bottom on a week with nothing won', () => {
    expect(seDaysWonTrend([0, 0, 0], 40, 20, 2)?.points).toBe('2,18 20,18 38,18');
  });

  it('draws nothing without two days', () => {
    expect(seDaysWonTrend(undefined, 60, 20)).toBeNull();
    expect(seDaysWonTrend([3], 60, 20)).toBeNull();
  });

  it('puts the sample ticks on today', () => {
    expect(seGuestDaysWon({ total: 10, thisWeek: 2, days: [1, 0, 1] }, 2)).toEqual({ total: 12, thisWeek: 4, days: [1, 0, 3] });
  });
});

describe('Days won seen on this device', () => {
  it('uses the device total when it has one', () => {
    expect(seDaysWonSeenOn(4, 9)).toBe(4);
    expect(seDaysWonSeenOn(4, undefined)).toBe(4);
  });

  it('falls back to the account total', () => {
    expect(seDaysWonSeenOn(null, 9)).toBe(9);
    expect(seDaysWonSeenOn('x', undefined)).toBeUndefined();
  });
});
