import { describe, expect, it } from 'vitest';
import { normalizeQuoraProfileUrl } from './quora-url';

const CANONICAL = 'https://www.quora.com/profile/mary-t-i-1';

describe('normalizeQuoraProfileUrl', () => {
  // The case the owner reported: one Quora profile, three sign-ups, nothing flagged. Every way of
  // writing that profile has to land on one string, or the duplicate pill, the reward guard and the
  // spam denylist all compare strings that differ and conclude these are different people.
  it.each([
    ['the share link the Quora app gives you', 'https://www.quora.com/profile/Mary-T-I-1?ch=17&oid=2861214453&share=c2d5e5ae&srid=3ykASR&target_type=user'],
    ['the plain www link', 'https://www.quora.com/profile/Mary-T-I-1'],
    ['no www', 'https://quora.com/profile/Mary-T-I-1'],
    ['http rather than https', 'http://www.quora.com/profile/Mary-T-I-1'],
    ['a trailing slash', 'https://www.quora.com/profile/Mary-T-I-1/'],
    ['already lowercase', 'https://www.quora.com/profile/mary-t-i-1'],
    ['a page of the profile', 'https://www.quora.com/profile/Mary-T-I-1/answers'],
    ['a deeper page of the profile', 'https://quora.com/profile/Mary-T-I-1/answers/12345'],
    ['a hash', 'https://www.quora.com/profile/Mary-T-I-1#about'],
    ['whitespace around it', '  https://www.quora.com/profile/Mary-T-I-1  '],
  ])('treats %s as the same profile', (_label, input) => {
    expect(normalizeQuoraProfileUrl(input)).toBe(CANONICAL);
  });

  it('keeps two different profiles apart', () => {
    expect(normalizeQuoraProfileUrl('https://www.quora.com/profile/Mary-T-I-2')).not.toBe(CANONICAL);
  });

  it('rejects anything that is not a Quora profile URL', () => {
    expect(normalizeQuoraProfileUrl('https://www.quora.com/Is-this-a-question')).toBeNull();
    expect(normalizeQuoraProfileUrl('https://www.quora.com/profile/')).toBeNull();
    expect(normalizeQuoraProfileUrl('https://www.quora.com/profile')).toBeNull();
    // A look-alike host: quora.com.evil.example must never pass for quora.com.
    expect(normalizeQuoraProfileUrl('https://quora.com.evil.example/profile/Mary-T-I-1')).toBeNull();
    expect(normalizeQuoraProfileUrl('https://example.com/profile/Mary-T-I-1')).toBeNull();
    expect(normalizeQuoraProfileUrl('Mary-T-I-1')).toBeNull();
    expect(normalizeQuoraProfileUrl('')).toBeNull();
  });

  it('is stable: canonicalizing a canonical URL changes nothing', () => {
    expect(normalizeQuoraProfileUrl(CANONICAL)).toBe(CANONICAL);
  });
});
