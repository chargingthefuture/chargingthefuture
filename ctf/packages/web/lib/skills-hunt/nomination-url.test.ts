import { describe, expect, it } from 'vitest';

import { canonicalizeNominationUrl, extractQuoraProfileLink } from './nomination-url';

describe('extractQuoraProfileLink', () => {
  it('takes the link out of pasted text and drops the profile tab', () => {
    expect(extractQuoraProfileLink('/br \nhttps://www.quora.com/profile/Swiftness-8/activity')).toBe(
      'https://www.quora.com/profile/Swiftness-8',
    );
    // A single-line field drops the line break, so the same paste can arrive with a space or nothing.
    expect(extractQuoraProfileLink('/br https://www.quora.com/profile/Swiftness-8/activity')).toBe(
      'https://www.quora.com/profile/Swiftness-8',
    );
    expect(extractQuoraProfileLink('/brhttps://www.quora.com/profile/Swiftness-8/activity')).toBe(
      'https://www.quora.com/profile/Swiftness-8',
    );
  });

  it('drops any profile tab and a trailing slash after it', () => {
    expect(extractQuoraProfileLink('https://www.quora.com/profile/Mary-T-I-1/answers/')).toBe(
      'https://www.quora.com/profile/Mary-T-I-1',
    );
  });

  it('leaves a plain profile link and a non-profile link as they are', () => {
    expect(extractQuoraProfileLink(' https://www.quora.com/profile/Swiftness-8 ')).toBe(
      'https://www.quora.com/profile/Swiftness-8',
    );
    expect(extractQuoraProfileLink('https://www.quora.com/What-is-a-good-answer')).toBe(
      'https://www.quora.com/What-is-a-good-answer',
    );
  });

  it('returns the trimmed text when there is no link in it', () => {
    expect(extractQuoraProfileLink('  not a link ')).toBe('not a link');
  });
});

describe('canonicalizeNominationUrl', () => {
  it('gives the pasted text and the plain profile link the same identity', () => {
    const plain = canonicalizeNominationUrl('https://www.quora.com/profile/Swiftness-8');
    expect(plain).toBe('https://www.quora.com/profile/swiftness-8');
    expect(canonicalizeNominationUrl('/br \nhttps://www.quora.com/profile/Swiftness-8/activity')).toBe(plain);
  });

  it('still refuses a host that is not Quora and text with no link', () => {
    expect(canonicalizeNominationUrl('/br https://evil-quora.com/profile/x/activity')).toBeNull();
    expect(canonicalizeNominationUrl('/br')).toBeNull();
    expect(canonicalizeNominationUrl(null)).toBeNull();
  });
});
