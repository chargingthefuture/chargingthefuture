import { describe, expect, it } from 'vitest';
import {
  SE_PEOPLE_CATEGORIES,
  SE_PEOPLE_CATEGORY_SECTORS,
  sePeopleCategory,
  sePeopleFilter,
  sePersonLine,
  sePersonListedOnly,
  sePersonPlace,
  type SePerson,
} from '@ctf/shared';

const person: SePerson = {
  id: 'p1',
  name: 'Teodor Braskwell',
  headline: 'Helps with work',
  jobTitle: 'Career coach',
  claimed: true,
  region: 'Georgia',
  country: 'US',
  offering: ['Resume writing'],
  listed: ['Resume writing', 'Public speaking'],
};

describe('People shape shared by web and Android', () => {
  it('writes the place and the line under the name', () => {
    expect(sePersonPlace(person)).toBe('Georgia, US');
    expect(sePersonPlace({ region: null, country: 'NG' })).toBe('NG');
    expect(sePersonPlace({ region: ' ', country: null })).toBeNull();
    expect(sePersonLine(person)).toBe('Career coach · Georgia, US');
    expect(sePersonLine({ ...person, jobTitle: null, region: null, country: null })).toBe('Helps with work');
  });

  it('shows a skill once', () => {
    expect(sePersonListedOnly(person)).toEqual(['Public speaking']);
  });

  it('reads a chip from the address and keeps only the four categories for the route', () => {
    expect(sePeopleFilter('care')).toBe('care');
    expect(sePeopleFilter('nonsense')).toBe('all');
    expect(sePeopleCategory('offering')).toBeNull();
    expect(sePeopleCategory('tech')).toBe('tech');
  });

  it('puts every sector in at most one chip', () => {
    const all = SE_PEOPLE_CATEGORIES.flatMap((c) => SE_PEOPLE_CATEGORY_SECTORS[c]);
    expect(new Set(all).size).toBe(all.length);
  });
});
