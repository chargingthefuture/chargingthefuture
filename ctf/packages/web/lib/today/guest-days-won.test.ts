import { describe, expect, it } from 'vitest';
import { SE_CARD_DOT_ICONS, SE_GUEST_TICK_MAX_MS, SE_GUEST_TICK_MIN_MS, seCardDotIcon, seGuestDaysWon, seGuestTickDelayMs } from '@ctf/shared';

describe('signed-out Days won ticks', () => {
  it('waits between the shortest and longest interval', () => {
    expect(seGuestTickDelayMs(0)).toBe(SE_GUEST_TICK_MIN_MS);
    expect(seGuestTickDelayMs(0.999999)).toBeLessThanOrEqual(SE_GUEST_TICK_MAX_MS);
    expect(seGuestTickDelayMs(0.5)).toBe(55_000);
    expect(seGuestTickDelayMs(Number.NaN)).toBe(SE_GUEST_TICK_MIN_MS);
    expect(seGuestTickDelayMs(4)).toBe(SE_GUEST_TICK_MAX_MS);
  });

  it('adds one day per tick to the sample count and keeps the Preview tag', () => {
    expect(seGuestDaysWon({ total: 52.4, thisWeek: 3, sample: true }, 2)).toEqual({ total: 54.4, thisWeek: 5, sample: true });
    expect(seGuestDaysWon({ total: 52, thisWeek: 3 }, 0)).toEqual({ total: 52, thisWeek: 3 });
    expect(seGuestDaysWon(null, 3)).toBeNull();
  });
});

describe('timeline dot icons', () => {
  it('draws the board icons by kind and something for every kind', () => {
    expect(seCardDotIcon('ask').paths).toEqual(['M12 19V5M5 12l7-7 7 7']);
    expect(seCardDotIcon('offer').paths).toEqual(['M12 5v14M5 12l7 7 7-7']);
    for (const icon of Object.values(SE_CARD_DOT_ICONS)) expect(icon.paths.length).toBeGreaterThan(0);
  });
});
