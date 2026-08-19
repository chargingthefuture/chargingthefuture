import { describe, expect, it } from 'vitest';
import { COUNTRY_TABLE_SIZE, countryForCoordinates } from './country-from-coordinates';

// The country column exists so a reader can tell one town reporting from several countries
// reporting. These check the two ways that can go wrong: a real place named as the wrong country,
// and a place that should come back unmatched being confidently named as something.
describe('countryForCoordinates', () => {
  it('names the country for well-known places', () => {
    const cases: [number, number, string][] = [
      [39.7, -105.0, 'US'],
      [43.7, -79.4, 'CA'],
      [51.5, -0.1, 'GB'],
      [48.9, 2.4, 'FR'],
      [59.9, 10.8, 'NO'],
      [35.7, 139.7, 'JP'],
      [6.5, 3.4, 'NG'],
      [-33.9, 151.2, 'AU'],
      [-23.6, -46.6, 'BR'],
      [28.6, 77.2, 'IN'],
    ];
    for (const [latitude, longitude, expected] of cases) {
      expect(countryForCoordinates(latitude, longitude)?.code, `${latitude},${longitude}`).toBe(expected);
    }
  });

  it('returns nothing for open ocean rather than guessing the nearest land', () => {
    expect(countryForCoordinates(30.0, -40.0)).toBeNull();
    expect(countryForCoordinates(-40.0, -120.0)).toBeNull();
  });

  it('returns nothing for coordinates that are not real positions', () => {
    expect(countryForCoordinates(Number.NaN, 10)).toBeNull();
    expect(countryForCoordinates(91, 10)).toBeNull();
    expect(countryForCoordinates(10, 181)).toBeNull();
  });

  it('gives the same answer twice, since the answers are kept between calls', () => {
    const first = countryForCoordinates(39.7, -105.0);
    const second = countryForCoordinates(39.7, -105.0);
    expect(second).toEqual(first);
  });

  it('carries a full table of countries rather than a handful', () => {
    expect(COUNTRY_TABLE_SIZE).toBeGreaterThan(150);
  });
});
