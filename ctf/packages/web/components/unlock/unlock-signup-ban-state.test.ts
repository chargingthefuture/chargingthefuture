import { describe, expect, it } from 'vitest';
import type { UnlockSignupAccount } from 'lib/unlock/types';
import { accountAfterBanToggle, providerRefusalText } from './unlock-signup-ban-state';

function account(overrides: Partial<UnlockSignupAccount> = {}): UnlockSignupAccount {
  return {
    userId: 'user_1',
    name: 'Pat Doe',
    username: null,
    email: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    lastSignInAt: null,
    excluded: false,
    excludedNote: null,
    deletedTheirData: false,
    deletedAt: null,
    banned: false,
    bannedReason: null,
    bannedAt: null,
    bannedProviderApplied: true,
    hasSubmission: false,
    reviewStatus: null,
    submittedAt: null,
    unlockScreenViews: 0,
    quoraHint: null,
    ...overrides,
  } as UnlockSignupAccount;
}

describe('sign-up row after a ban or lift (issue #2804)', () => {
  it('marks a ban the provider refused as not applied at sign-in', () => {
    const next = accountAfterBanToggle(account(), true, false);
    expect(next.banned).toBe(true);
    expect(next.bannedReason).toBe('perp');
    expect(next.bannedProviderApplied).toBe(false);
  });

  it('keeps the reason and date of an existing ban on a retry', () => {
    const banned = account({ banned: true, bannedReason: 'spam', bannedAt: '2026-10-02T00:00:00.000Z', bannedProviderApplied: false });
    const next = accountAfterBanToggle(banned, true, true);
    expect(next.bannedReason).toBe('spam');
    expect(next.bannedAt).toBe('2026-10-02T00:00:00.000Z');
    expect(next.bannedProviderApplied).toBe(true);
  });

  it('leaves the account banned when the provider refused the lift', () => {
    const banned = account({ banned: true, bannedReason: 'perp', bannedAt: '2026-10-02T00:00:00.000Z' });
    expect(accountAfterBanToggle(banned, false, false)).toBe(banned);
  });

  it('clears the ban when the lift applied', () => {
    const banned = account({ banned: true, bannedReason: 'perp', bannedAt: '2026-10-02T00:00:00.000Z' });
    const next = accountAfterBanToggle(banned, false, true);
    expect(next.banned).toBe(false);
    expect(next.bannedReason).toBeNull();
  });

  it('names the account in the refusal message', () => {
    expect(providerRefusalText(account(), 'user_1', true, 'rate limited')).toContain('Pat Doe: banned in this app');
    expect(providerRefusalText(undefined, 'user_9', false, null)).toContain('user_9: the ban could not be lifted');
  });
});
