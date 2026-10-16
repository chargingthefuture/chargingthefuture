import type { UnlockSignupAccount } from 'lib/unlock/types';

// What a ban or a lift on the sign-up list changes, from what the route said (issue #2804). The ban is
// two writes: the row this app reads, and the ban at the sign-in provider. Either half of a lift, or
// the provider half of a ban, can be refused, and the row has to say which.

// The row after the press. A lift the provider refused leaves the account banned, because it still is
// at sign-in. A ban keeps the reason and date the account already had, so a retry does not relabel it.
export function accountAfterBanToggle(
  account: UnlockSignupAccount,
  banned: boolean,
  providerOk: boolean,
): UnlockSignupAccount {
  if (!banned) {
    if (!providerOk) return account;
    return { ...account, banned: false, bannedReason: null, bannedAt: null, bannedProviderApplied: true };
  }
  return {
    ...account,
    banned: true,
    bannedReason: account.bannedReason ?? 'perp',
    bannedAt: account.bannedAt ?? new Date().toISOString(),
    bannedProviderApplied: providerOk,
  };
}

function accountLabel(account: UnlockSignupAccount | undefined, userId: string): string {
  if (!account) return userId;
  if (account.name) return account.name;
  if (account.username) return `@${account.username}`;
  return account.email ?? userId;
}

// The panel message for a press the provider refused, naming the account it is about.
export function providerRefusalText(
  account: UnlockSignupAccount | undefined,
  userId: string,
  banned: boolean,
  reason: string | null | undefined,
): string {
  const who = accountLabel(account, userId);
  const why = reason ?? 'the sign-in provider did not say why';
  return banned
    ? `${who}: banned in this app, but the sign-in ban did not go through (${why}). They can still sign in. Press "Try the sign-in ban again" on their row.`
    : `${who}: the ban could not be lifted at sign-in (${why}). They are still banned. Press "Lift this ban" to try again.`;
}
