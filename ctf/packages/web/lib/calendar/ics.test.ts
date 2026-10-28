import { describe, expect, it } from 'vitest';
import { seCalendarFileName, seCalendarIcs } from '@ctf/shared';

describe('seCalendarIcs', () => {
  it('writes one event in UTC with escaped text', () => {
    const ics = seCalendarIcs(
      { uid: 'slot-1', title: 'Rent, food; and work', startIso: '2026-10-30T18:00:00.000Z', endIso: '2026-10-30T19:00:00.000Z', url: 'https://app.chargingthefuture.com/ti-radio' },
      new Date('2026-10-28T00:00:00.000Z'),
    );
    expect(ics).toContain('DTSTART:20261030T180000Z');
    expect(ics).toContain('DTEND:20261030T190000Z');
    expect(ics).toContain('SUMMARY:Rent\\, food\; and work');
    expect(ics).toContain('URL:https://app.chargingthefuture.com/ti-radio');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });

  it('names the file from the title', () => {
    expect(seCalendarFileName('Talk: Rent & food!')).toBe('talk-rent-food.ics');
    expect(seCalendarFileName('***')).toBe('event.ics');
  });
});
