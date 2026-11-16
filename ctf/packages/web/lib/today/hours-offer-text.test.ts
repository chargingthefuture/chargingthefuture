import { describe, expect, it } from 'vitest';
import { SE_HOURS_OFFER_WORDS, seHoursOfferText } from '@ctf/shared';

describe('seHoursOfferText', () => {
  it('uses the short line as the title and names the skills', () => {
    expect(seHoursOfferText({ shortDescription: '  An hour of math  help ', headline: 'Teacher', skillNames: ['Tutoring', 'Editing'] })).toEqual({
      title: 'An hour of math help',
      body: 'Skills offered: Tutoring, Editing.',
    });
  });

  it('falls back to the headline, then to plain words, and leaves the body out with no skills', () => {
    expect(seHoursOfferText({ shortDescription: ' ', headline: 'Cook', skillNames: [] })).toEqual({ title: 'Cook', body: null });
    expect(seHoursOfferText({ shortDescription: null, headline: null, skillNames: [] }).title).toBe(SE_HOURS_OFFER_WORDS.untitled);
  });

  it('clips a long line', () => {
    const { title } = seHoursOfferText({ shortDescription: 'x'.repeat(200), headline: null, skillNames: [] });
    expect(title.length).toBe(90);
    expect(title.endsWith('…')).toBe(true);
  });
});
