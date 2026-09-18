import { describe, expect, it } from 'vitest';
import { canonicalizeQuoraUrl } from './quora-url';

const PROFILE = 'https://www.quora.com/profile/mary-t-i-1';

describe('canonicalizeQuoraUrl', () => {
  // The defect this replaced: each of these was stored as a different string, so a taken-down
  // profile could be re-listed by dropping `www.`, and one person could be nominated twice in a
  // round by adding a trailing slash.
  it.each([
    ['the share link Quora produces', 'https://www.quora.com/profile/Mary-T-I-1?ch=17&share=abc'],
    ['no www', 'https://quora.com/profile/Mary-T-I-1'],
    ['http rather than https', 'http://www.quora.com/profile/Mary-T-I-1'],
    ['a trailing slash', 'https://www.quora.com/profile/Mary-T-I-1/'],
    ['several trailing slashes', 'https://www.quora.com/profile/Mary-T-I-1///'],
    ['already lowercase', 'https://www.quora.com/profile/mary-t-i-1'],
    ['a hash', 'https://www.quora.com/profile/Mary-T-I-1#about'],
    ['a language subdomain', 'https://es.quora.com/profile/Mary-T-I-1'],
    ['whitespace around it', '  https://quora.com/profile/Mary-T-I-1  '],
  ])('treats %s as the same link', (_label, input) => {
    expect(canonicalizeQuoraUrl(input)).toBe(PROFILE);
  });

  // Unlike Unlock's stricter rule, any Quora path is accepted here: a nominated person may be
  // identified by something they posted rather than by their profile.
  it('accepts a link to a post, not only a profile', () => {
    expect(canonicalizeQuoraUrl('https://www.quora.com/Why-Is-The-Sky-Blue/answer/Mary-T-I-1?ch=9')).toBe(
      'https://www.quora.com/why-is-the-sky-blue/answer/mary-t-i-1',
    );
  });

  it('keeps two different links apart', () => {
    expect(canonicalizeQuoraUrl('https://www.quora.com/profile/Mary-T-I-2')).not.toBe(PROFILE);
  });

  // The old rule accepted any host ending in "quora.com", so a look-alike domain passed for the
  // real one.
  it('rejects a look-alike host', () => {
    expect(canonicalizeQuoraUrl('https://evil-quora.com/profile/Mary-T-I-1')).toBeNull();
    expect(canonicalizeQuoraUrl('https://quora.com.evil.example/profile/Mary-T-I-1')).toBeNull();
    expect(canonicalizeQuoraUrl('https://example.com/profile/Mary-T-I-1')).toBeNull();
  });

  it('rejects a bare host, a non-URL, and nothing at all', () => {
    expect(canonicalizeQuoraUrl('https://www.quora.com')).toBeNull();
    expect(canonicalizeQuoraUrl('https://www.quora.com/')).toBeNull();
    expect(canonicalizeQuoraUrl('Mary-T-I-1')).toBeNull();
    expect(canonicalizeQuoraUrl('')).toBeNull();
    expect(canonicalizeQuoraUrl(null)).toBeNull();
    expect(canonicalizeQuoraUrl(undefined)).toBeNull();
  });

  it('is stable: canonicalizing a canonical URL changes nothing', () => {
    expect(canonicalizeQuoraUrl(PROFILE)).toBe(PROFILE);
  });
});
