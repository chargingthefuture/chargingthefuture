import { describe, expect, it } from 'vitest';
import { formatUpcomingWhen, pickUpcoming } from './upcoming';

// What Chyme shows from the TI Radio guide: only booked slots that have not ended, soonest first,
// with the slot on air now at the top, and never more than the cap. A malformed slot in the payload
// is skipped rather than taking the whole list down.

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-09-19T12:00:00Z');
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * HOUR).toISOString();
const slot = (startHours: number, booked: boolean, isOnAir = false) => ({
  slotStartIso: at(startHours),
  slotEndIso: at(startHours + 1.5),
  isOnAir,
  booking: booked ? { title: `Talk at ${startHours}`, hostUsername: 'farah' } : null,
});

describe('pickUpcoming', () => {
  it('keeps booked slots that have not ended, in order, up to the cap', () => {
    const picked = pickUpcoming([slot(-3, true), slot(-1, true, true), slot(0.5, false), slot(2, true), slot(4, true), slot(6, true), slot(8, true)], now, 3);
    expect(picked.map((s) => s.title)).toEqual(['Talk at -1', 'Talk at 2', 'Talk at 4']);
    expect(picked[0].isOnAir).toBe(true);
  });

  it('drops slots that already ended and open slots', () => {
    expect(pickUpcoming([slot(-3, true), slot(1, false)], now)).toEqual([]);
  });

  it('skips a malformed entry instead of failing', () => {
    const picked = pickUpcoming([null, { nonsense: true }, slot(1, true)], now);
    expect(picked).toHaveLength(1);
  });
});

describe('formatUpcomingWhen', () => {
  it('says Today, Tomorrow, or the date, in the given timezone', () => {
    expect(formatUpcomingWhen(at(2), at(3.5), now, 'UTC')).toBe('Today · 2:00 PM – 3:30 PM');
    expect(formatUpcomingWhen(at(26), at(27.5), now, 'UTC')).toBe('Tomorrow · 2:00 PM – 3:30 PM');
    expect(formatUpcomingWhen(at(50), at(51.5), now, 'UTC')).toBe('Mon, Sep 21 · 2:00 PM – 3:30 PM');
  });
});
