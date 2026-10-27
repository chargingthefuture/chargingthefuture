import { describe, expect, it } from 'vitest';
import { SE_HOLIDAY_ASKS, seAskSuggestions } from '@ctf/shared';

describe('+ New ask suggestions', () => {
  it('carries all 44 holiday asks', () => {
    expect(SE_HOLIDAY_ASKS.flatMap((group) => group.asks)).toHaveLength(44);
  });

  it('offers one from each group before anything is typed', () => {
    expect(seAskSuggestions('').map((item) => item.group)).toEqual(['Food', 'Getting around', 'Warmth', 'Care', 'Home', 'Paperwork and services']);
  });

  it('matches every typed word, and names the group', () => {
    expect(seAskSuggestions('ride pharmacy')).toEqual([{ text: 'A ride to the pharmacy or grocery store', group: 'Getting around' }]);
    expect(seAskSuggestions('zzz')).toEqual([]);
  });
});
