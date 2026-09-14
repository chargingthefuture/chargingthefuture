import { describe, expect, it } from 'vitest';
import {
  currentSlotStartMs,
  exceedsRollingCap,
  guideSlotStarts,
  isWithinGuideWindow,
  nextSlotStartMs,
  normalizeSlotIso,
  TI_RADIO_SLOT_MS,
} from './slots';

const HOUR = 60 * 60 * 1000;

describe('the 90-minute grid', () => {
  it('puts sixteen starts in a day, beginning at midnight UTC', () => {
    const starts = guideSlotStarts(new Date('2026-09-14T00:00:00.000Z'), 1);
    expect(starts).toHaveLength(16);
    expect(starts[0]).toBe('2026-09-14T00:00:00.000Z');
    expect(starts[1]).toBe('2026-09-14T01:30:00.000Z');
    expect(starts[15]).toBe('2026-09-14T22:30:00.000Z');
  });

  it('starts the guide at the slot on air, not the next one', () => {
    // 10:15 sits inside the 09:00 slot, and a guide that drops the programme playing right now is
    // the one thing a guide must not do.
    const starts = guideSlotStarts(new Date('2026-09-14T10:15:00.000Z'), 1);
    expect(starts[0]).toBe('2026-09-14T09:00:00.000Z');
  });

  it('rounds up to the next start and down to the current one', () => {
    const mid = new Date('2026-09-14T10:15:00.000Z');
    expect(new Date(nextSlotStartMs(mid)).toISOString()).toBe('2026-09-14T10:30:00.000Z');
    expect(new Date(currentSlotStartMs(mid)).toISOString()).toBe('2026-09-14T09:00:00.000Z');
  });

  it('leaves a time already on a boundary where it is', () => {
    const onGrid = new Date('2026-09-14T09:00:00.000Z');
    expect(nextSlotStartMs(onGrid)).toBe(onGrid.getTime());
  });
});

describe('normalizeSlotIso', () => {
  it('accepts a start on the grid and returns the canonical spelling', () => {
    expect(normalizeSlotIso('2026-09-14T09:00:00+00:00')).toBe('2026-09-14T09:00:00.000Z');
  });

  it('refuses a time between starts rather than moving it', () => {
    expect(normalizeSlotIso('2026-09-14T09:20:00.000Z')).toBeNull();
  });

  it('refuses anything unparseable or absent', () => {
    expect(normalizeSlotIso('next tuesday')).toBeNull();
    expect(normalizeSlotIso('')).toBeNull();
    expect(normalizeSlotIso(null)).toBeNull();
    expect(normalizeSlotIso(1757840400000)).toBeNull();
  });
});

describe('isWithinGuideWindow', () => {
  const now = new Date('2026-09-14T10:15:00.000Z');

  it('accepts a start inside the week the guide covers', () => {
    expect(isWithinGuideWindow(Date.parse('2026-09-17T15:00:00.000Z'), now)).toBe(true);
  });

  it('refuses a start before the slot on air', () => {
    expect(isWithinGuideWindow(Date.parse('2026-09-14T07:30:00.000Z'), now)).toBe(false);
  });

  it('refuses a start past the end of the week', () => {
    expect(isWithinGuideWindow(Date.parse('2026-09-30T09:00:00.000Z'), now)).toBe(false);
  });
});

describe('exceedsRollingCap', () => {
  const base = Date.parse('2026-09-14T09:00:00.000Z');

  it('allows a member with nothing booked', () => {
    expect(exceedsRollingCap([], base)).toBe(false);
  });

  it('allows a third slot in the same stretch', () => {
    expect(exceedsRollingCap([base, base + 2 * HOUR], base + 4 * HOUR)).toBe(false);
  });

  it('refuses a fourth slot in the same stretch', () => {
    expect(exceedsRollingCap([base, base + 2 * HOUR, base + 4 * HOUR], base + 6 * HOUR)).toBe(true);
  });

  // The reason the rule is a rolling window and not a calendar day: three slots late on one evening
  // and a fourth after midnight is four in five hours, which is what the ceiling is there to stop.
  it('refuses a fourth slot that crosses midnight', () => {
    const evening = Date.parse('2026-09-14T21:00:00.000Z');
    expect(exceedsRollingCap([evening, evening + 1.5 * HOUR, evening + 3 * HOUR], evening + 4.5 * HOUR)).toBe(true);
  });

  it('allows a fourth slot once the first has fallen out of the window', () => {
    expect(exceedsRollingCap([base, base + 2 * HOUR, base + 4 * HOUR], base + 24 * HOUR)).toBe(false);
  });

  it('counts backwards as well as forwards', () => {
    // Booking an earlier slot can just as easily make four in a day as booking a later one.
    expect(exceedsRollingCap([base, base + 2 * HOUR, base + 4 * HOUR], base - 2 * HOUR)).toBe(true);
  });

  it('treats a slot exactly 24 hours away as a different day', () => {
    expect(exceedsRollingCap([base, base + 12 * HOUR, base + 18 * HOUR], base + 24 * HOUR)).toBe(false);
  });

  it('honors a cap passed in', () => {
    expect(exceedsRollingCap([base], base + 2 * HOUR, 1)).toBe(true);
  });
});

describe('TI_RADIO_SLOT_MS', () => {
  it('is ninety minutes', () => {
    expect(TI_RADIO_SLOT_MS).toBe(90 * 60 * 1000);
  });
});
