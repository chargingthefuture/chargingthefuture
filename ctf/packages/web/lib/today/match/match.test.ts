import { describe, expect, it } from 'vitest';
import {
  SE_MATCH_NEEDS,
  SE_MATCH_WORDS,
  sePeopleChips,
  sePeopleFilter,
  sePeopleParams,
  seMatchCode,
  seMatchNeedKeys,
  seMatchNeedsCovered,
  seMatchTitleNames,
  seParseMatchChange,
} from '@ctf/shared';

describe('the Match card words and needs', () => {
  it('reads a landing page code however it was typed', () => {
    expect(seMatchCode(' abcde fghjk ')).toBe('ABCDE-FGHJK');
    expect(seMatchCode('ABCDE-FGHJK')).toBe('ABCDE-FGHJK');
    // O, I, S, 0, 1 and 5 are not in the landing page's alphabet.
    expect(seMatchCode('ABCDE-FGHJO')).toBeNull();
    expect(seMatchCode('ABCDE')).toBeNull();
    expect(seMatchCode(null)).toBeNull();
  });

  it('keeps known need keys once each, in order', () => {
    expect(seMatchNeedKeys(['food', 'nope', 'housing', 'food', 3])).toEqual(['food', 'housing']);
    expect(seMatchNeedKeys('food')).toEqual([]);
  });

  it('parses a change: needs, or a code', () => {
    expect(seParseMatchChange({ needs: ['legal'] })).toEqual({ kind: 'needs', needKeys: ['legal'] });
    expect(seParseMatchChange({ needs: [] })).toBeNull();
    expect(seParseMatchChange({ code: 'abcdefghjk' })).toEqual({ kind: 'code', code: 'ABCDE-FGHJK' });
    expect(seParseMatchChange({ code: 'bad' })).toBeNull();
    expect(seParseMatchChange(null)).toBeNull();
  });

  it('lists the job titles behind needs once each', () => {
    const names = seMatchTitleNames(['legal', 'harass']);
    expect(names.filter((name) => name === 'Lawyers')).toHaveLength(1);
    expect(names).toContain('Cybersecurity Specialists');
  });

  it('puts a code back on the needs it covers in full', () => {
    const idsByName = new Map<string, string[]>([
      ['Lawyers', ['1']],
      ['Lawyers / Legal Consultants', ['2']],
      ['Childcare Workers', ['3']],
    ]);
    // A title the taxonomy does not hold is left out of a need, as on the landing page, so Childcare
    // is covered by Childcare Workers alone here, and Harassment and Keep a record by the two lawyer titles.
    expect(seMatchNeedsCovered(['1', '2', '3'], idsByName)).toEqual(['kids', 'legal', 'harass', 'record']);
    expect(seMatchNeedsCovered(['1', '2'], idsByName)).toEqual(['legal', 'harass', 'record']);
    expect(seMatchNeedsCovered(['1'], idsByName)).toEqual([]);
  });

  it('has twenty needs with unique keys, as the landing page does', () => {
    expect(SE_MATCH_NEEDS).toHaveLength(20);
    expect(new Set(SE_MATCH_NEEDS.map((need) => need.key)).size).toBe(20);
  });

  it('says person for one and people otherwise', () => {
    expect(SE_MATCH_WORDS.fit(1)).toBe('person fits what you need');
    expect(SE_MATCH_WORDS.fit(4)).toBe('people fit what you need');
  });
});

describe("People's Fits what you need filter", () => {
  it('reads fits from the address and asks the server for it', () => {
    expect(sePeopleFilter('fits')).toBe('fits');
    expect(sePeopleParams(2, 'fits', '')).toBe('page=2&fits=1');
    expect(sePeopleParams(1, 'trades', ' tax ')).toBe('page=1&category=trades&q=tax');
  });

  it('shows the Fits chip only while it is chosen', () => {
    expect(sePeopleChips('fits')[0]?.id).toBe('fits');
    expect(sePeopleChips('all').some((chip) => chip.id === 'fits')).toBe(false);
  });
});
