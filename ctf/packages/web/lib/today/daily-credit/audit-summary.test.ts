import { describe, expect, it } from 'vitest';
import {
  clampDailyCreditPage,
  dailyCreditLogMemberIds,
  dailyCreditStatusLabel,
  pickedSomeoneElse,
  summarizeDailyCredits,
  toDailyCreditLogRows,
  type DailyCreditCardRecord,
} from './audit-summary';
import { dailyCreditLogAsPlainText } from './audit-text';

const card = (day: string, asker: string, helpers: string[], picked: string | null, status: 'held' | 'granted' | null = picked ? 'granted' : null): DailyCreditCardRecord => ({
  day,
  cardId: `commons-ask:${day}`,
  askerUserId: asker,
  chosenAt: `${day} 00:00:01+00`,
  helpers: helpers.map((userId, index) => ({ userId, answeredAt: `${day} 0${index}:00:00+00` })),
  pickedUserId: picked,
  confirmedAt: picked ? `${day} 12:00:00+00` : null,
  creditStatus: status,
  grantedAt: status === 'granted' ? `${day} 12:00:01+00` : null,
});

const closed = [
  card('2026-11-01', 'asker-a', ['m1', 'friend'], 'friend'),
  card('2026-11-02', 'asker-a', ['m2', 'friend'], 'friend'),
  card('2026-11-03', 'asker-a', ['friend'], 'friend', 'held'),
  card('2026-11-04', 'asker-b', ['m3'], 'm3'),
  card('2026-11-05', 'asker-b', [], 'm4'),
];

describe('daily credit audit summaries', () => {
  it('counts closed cards, distinct helpers and picks past the first answer per asker', () => {
    const { askers } = summarizeDailyCredits(closed);
    expect(askers).toEqual([
      { askerUserId: 'asker-a', closed: 3, distinctHelpers: 1, pickedNotFirst: 2 },
      { askerUserId: 'asker-b', closed: 2, distinctHelpers: 2, pickedNotFirst: 0 },
    ]);
  });

  it('counts granted and held credits and distinct askers per helper', () => {
    const { helpers } = summarizeDailyCredits(closed);
    expect(helpers[0]).toEqual({ helperUserId: 'friend', granted: 2, held: 1, distinctAskers: 1 });
    expect(helpers).toHaveLength(3);
  });

  it('flags an asker who picked the same helper three or more times', () => {
    expect(summarizeDailyCredits(closed).repeatPairs).toEqual([{ askerUserId: 'asker-a', helperUserId: 'friend', count: 3 }]);
    expect(summarizeDailyCredits(closed.slice(0, 2)).repeatPairs).toEqual([]);
  });

  it('marks page rows against the counts from the entire log', () => {
    const page = [card('2026-11-06', 'asker-c', ['m5'], null), closed[0], closed[4]];
    const rows = toDailyCreditLogRows(page, closed);
    expect(rows[0]).toMatchObject({ flagged: false, pairCount: 0, pickedFirst: false, pickedAnswered: false });
    expect(rows[1]).toMatchObject({ flagged: true, pairCount: 3, pickedFirst: false, pickedAnswered: true });
    expect(rows[2]).toMatchObject({ flagged: false, pickedFirst: false, pickedAnswered: false });
    expect(dailyCreditLogMemberIds(rows, summarizeDailyCredits(closed)).sort()).toEqual(
      ['asker-a', 'asker-b', 'asker-c', 'friend', 'm1', 'm3', 'm4', 'm5'].sort(),
    );
  });

  it('does not count a pick with no I can help answers as passing over the first', () => {
    expect(pickedSomeoneElse(closed[4])).toBe(false);
    expect(pickedSomeoneElse(closed[0])).toBe(true);
  });

  it('labels the credit state', () => {
    expect(dailyCreditStatusLabel(card('2026-11-07', 'a', [], null))).toBe('Not closed');
    expect(dailyCreditStatusLabel(closed[2])).toBe('Held for Unlock');
    expect(dailyCreditStatusLabel(closed[0])).toBe('Granted');
    expect(dailyCreditStatusLabel({ pickedUserId: 'x', creditStatus: 'granted', grantedAt: null })).toBe('Granting');
  });

  it('clamps the requested page', () => {
    expect(clampDailyCreditPage(null, 60)).toBe(1);
    expect(clampDailyCreditPage('abc', 60)).toBe(1);
    expect(clampDailyCreditPage('2', 60)).toBe(2);
    expect(clampDailyCreditPage('9', 60)).toBe(3);
    expect(clampDailyCreditPage('4', 0)).toBe(1);
  });

  it('writes the visible page as plain text with the flag and summaries', () => {
    const rows = toDailyCreditLogRows([closed[0]], closed);
    const text = dailyCreditLogAsPlainText({ page: 1, pageCount: 1, total: 5, rows, summaries: summarizeDailyCredits(closed), nameOf: (id) => `@${id}` });
    expect(text).toContain('2026-11-01 · card commons-ask:2026-11-01');
    expect(text).toContain('I can help: 1. @m1, 2. @friend');
    expect(text).toContain('Picked: @friend (not the first to answer)');
    expect(text).toContain('Flag: this asker picked this helper 3 times');
    expect(text).toContain('@asker-a → @friend: 3');
  });
});
