import { describe, expect, it } from 'vitest';
import { nameFromQuoraProfileUrl } from './name-from-quora-url';

describe('nameFromQuoraProfileUrl', () => {
  it('turns a lowercase profile address into a capitalized name', () => {
    expect(nameFromQuoraProfileUrl('https://www.quora.com/profile/farah-brunache')).toBe('Farah Brunache');
  });

  it('drops the number Quora adds to a taken name and keeps the casing as typed', () => {
    expect(nameFromQuoraProfileUrl('https://www.quora.com/profile/TJW-38')).toBe('TJW');
    expect(nameFromQuoraProfileUrl('https://quora.com/profile/Mary-T-I-1/answers?ch=17')).toBe('Mary T I');
  });

  it('accepts a language subdomain and a trailing slash', () => {
    expect(nameFromQuoraProfileUrl('https://es.quora.com/profile/farah-brunache/')).toBe('Farah Brunache');
  });

  it('returns null for anything that is not a Quora profile link', () => {
    expect(nameFromQuoraProfileUrl('')).toBeNull();
    expect(nameFromQuoraProfileUrl('farah-brunache')).toBeNull();
    expect(nameFromQuoraProfileUrl('https://evil-quora.com/profile/farah-brunache')).toBeNull();
    expect(nameFromQuoraProfileUrl('https://www.quora.com/What-is-a-skill')).toBeNull();
    expect(nameFromQuoraProfileUrl('https://www.quora.com/profile/')).toBeNull();
  });

  it('returns null when nothing name-like is left', () => {
    expect(nameFromQuoraProfileUrl('https://www.quora.com/profile/12345')).toBeNull();
  });
});
