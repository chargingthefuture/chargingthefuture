import { describe, expect, it } from 'vitest';
import {
  SE_THEME_ORDER,
  seClockLabel,
  seInQuietHours,
  seInQuietMinute,
  seMeName,
  seMeSince,
  seNotifyGroup,
  seParseClock,
  seParseMePrompts,
  seReadableTokens,
  seTheme,
  seThemeNote,
} from '@ctf/shared';

describe('3.1 Me and Settings logic', () => {
  it('reads the three profile lines, folding spaces and refusing long or non-text ones', () => {
    expect(seParseMePrompts({ canHelpWith: '  Web   apps\n and servers ', needs: '' })).toEqual({
      canHelpWith: 'Web apps and servers',
      needs: '',
      askMeAbout: '',
    });
    expect(seParseMePrompts({ needs: 'x'.repeat(141) })).toBeNull();
    expect(seParseMePrompts({ askMeAbout: 3 })).toBeNull();
  });

  it('names the member without the @ and dates their start by month', () => {
    expect(seMeName('@farah')).toBe('farah');
    expect(seMeName(null)).toBe('Survivor');
    expect(seMeSince('2026-06-03T12:00:00Z')).toBe('June 2026');
    expect(seMeSince(null)).toBeNull();
  });

  it('puts each notification type under its Settings row', () => {
    expect(seNotifyGroup('commons.reply')).toBe('replies');
    expect(seNotifyGroup('today.card.pair_request')).toBe('replies');
    expect(seNotifyGroup('chyme.room.started')).toBe('rooms');
    expect(seNotifyGroup('service-credits.received')).toBe('other');
  });

  it('holds pings in quiet hours, across midnight too', () => {
    expect(seInQuietMinute(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(seInQuietMinute(6 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(seInQuietMinute(12 * 60, 22 * 60, 7 * 60)).toBe(false);
    expect(seInQuietMinute(10 * 60, 9 * 60, 17 * 60)).toBe(true);
    expect(seInQuietMinute(10 * 60, 9 * 60, 9 * 60)).toBe(false);
    const quiet = { startMinute: 22 * 60, endMinute: 7 * 60, timeZone: 'America/New_York' };
    expect(seInQuietHours(quiet, new Date('2026-11-11T04:00:00Z'))).toBe(true);
    expect(seInQuietHours(quiet, new Date('2026-11-11T17:00:00Z'))).toBe(false);
    expect(seInQuietHours(null, new Date())).toBe(false);
  });

  it('formats and reads clock times', () => {
    expect(seClockLabel(22 * 60)).toBe('10:00 PM');
    expect(seClockLabel(7 * 60 + 5)).toBe('7:05 AM');
    expect(seClockLabel(0)).toBe('12:00 AM');
    expect(seParseClock('22:30')).toBe(22 * 60 + 30);
    expect(seParseClock('25:00')).toBeNull();
  });

  it('draws soft text and faint borders strong under higher contrast', () => {
    const t = seTheme('forest', 'light');
    expect(seReadableTokens(t, false)).toBe(t);
    expect(seReadableTokens(t, true)).toMatchObject({ soft: t.ink, hair: t.line });
  });

  it('lists the default color first and marks it', () => {
    expect(SE_THEME_ORDER[0]).toBe('burgundy');
    expect(seThemeNote('burgundy')).toBe('Default · The landing page');
    expect(seThemeNote('teal-purple')).toBe('The first wallpaper');
  });
});
