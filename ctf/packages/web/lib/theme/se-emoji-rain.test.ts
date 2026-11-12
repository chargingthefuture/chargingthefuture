import { describe, expect, it } from 'vitest';
import { SE_EMOJI_RAIN, isSeDaysWonSeen, seEmojiRainDrops, seEmojiRainStep } from '@ctf/shared';

describe('seEmojiRainStep', () => {
  it('decides nothing until the account has answered', () => {
    expect(seEmojiRainStep({ on: true, total: 12, seen: undefined })).toEqual({ rain: false, record: null });
  });

  it('records the first total it sees without raining', () => {
    expect(seEmojiRainStep({ on: true, total: 12, seen: null })).toEqual({ rain: false, record: 12 });
  });

  it('rains when the total went up and the switch is on', () => {
    expect(seEmojiRainStep({ on: true, total: 13, seen: 12 })).toEqual({ rain: true, record: 13 });
  });

  it('records but does not rain with the switch off', () => {
    expect(seEmojiRainStep({ on: false, total: 13, seen: 12 })).toEqual({ rain: false, record: 13 });
  });

  it('does nothing when the total has not changed', () => {
    expect(seEmojiRainStep({ on: true, total: 12, seen: 12 })).toEqual({ rain: false, record: null });
  });

  it('records a lower total without raining', () => {
    expect(seEmojiRainStep({ on: true, total: 10, seen: 12 })).toEqual({ rain: false, record: 10 });
  });

  it('never records a sample or a missing total', () => {
    expect(seEmojiRainStep({ on: true, total: 40, sample: true, seen: 12 })).toEqual({ rain: false, record: null });
    expect(seEmojiRainStep({ on: true, total: null, seen: 12 })).toEqual({ rain: false, record: null });
  });
});

describe('seEmojiRainDrops', () => {
  it('spreads the drops across the width with the shared emoji', () => {
    const drops = seEmojiRainDrops();
    expect(drops).toHaveLength(18);
    for (const drop of drops) {
      expect(SE_EMOJI_RAIN).toContain(drop.emoji);
      expect(drop.leftPct).toBeGreaterThanOrEqual(0);
      expect(drop.leftPct).toBeLessThanOrEqual(94);
      expect(drop.delayMs + drop.fallMs).toBeLessThanOrEqual(3200);
    }
    expect(new Set(drops.map((drop) => drop.key)).size).toBe(18);
  });
});

describe('isSeDaysWonSeen', () => {
  it('takes a count of days and refuses anything else', () => {
    expect(isSeDaysWonSeen(0)).toBe(true);
    expect(isSeDaysWonSeen(41)).toBe(true);
    expect(isSeDaysWonSeen(-1)).toBe(false);
    expect(isSeDaysWonSeen(1.5)).toBe(false);
    expect(isSeDaysWonSeen('3')).toBe(false);
  });
});
