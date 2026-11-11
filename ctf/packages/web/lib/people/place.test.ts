import { describe, expect, it } from 'vitest';
import { countryCode, regionName } from './place';

describe('People place', () => {
  it('turns a country name into its two-letter code', () => {
    expect(countryCode('United States')).toBe('US');
    expect(countryCode('Canada')).toBe('CA');
    expect(countryCode('Nigeria')).toBe('NG');
    expect(countryCode('Bosnia and Herzegovina')).toBe('BA');
    expect(countryCode('Cabo Verde')).toBe('CV');
    expect(countryCode('us')).toBe('US');
  });

  it('keeps a name it has no code for, and drops an empty one', () => {
    expect(countryCode('Atlantis')).toBe('Atlantis');
    expect(countryCode('  ')).toBeNull();
    expect(countryCode(null)).toBeNull();
    expect(regionName(' Georgia ')).toBe('Georgia');
    expect(regionName('')).toBeNull();
  });
});
