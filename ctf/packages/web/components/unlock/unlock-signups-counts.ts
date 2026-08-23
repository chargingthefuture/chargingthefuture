// Pure counting and filtering for the Unlock sign-ups panel. Kept apart from the panel component so the
// panel file holds only rendering and its own open/closed state, and so these rules can be read (and
// changed) without scrolling past markup.

import type { UnlockSignupAccount } from 'lib/unlock/types';

export type SignupTab = 'not-submitted' | 'all' | 'excluded' | 'deleted';

export const SIGNUP_TABS: readonly SignupTab[] = ['not-submitted', 'all', 'excluded', 'deleted'];

export const TAB_LABEL: Record<SignupTab, string> = {
  'not-submitted': 'No Quora URL',
  all: 'All sign-ups',
  excluded: 'Demo / test',
  deleted: 'Left',
};

// Whether this account counts as a member: not a demo/test account, and not someone who deleted their
// data. A demo/test mark wins over a deletion mark so nobody is subtracted twice.
export function isCounted(account: UnlockSignupAccount): boolean {
  return !account.excluded && !account.deletedTheirData;
}

// Has this member never signed in again since the day they signed up? A hint, not proof — the provider
// stamps the last sign-in on a fresh sign-in, not on every visit. The Unlock-screen view count beside it
// is the firmer reading.
export function neverReturned(account: UnlockSignupAccount): boolean {
  if (!account.lastSignInAt) return true;
  return account.lastSignInAt.slice(0, 10) === account.createdAt.slice(0, 10);
}

export type SignupCounts = ReturnType<typeof summarize>;

// The numbers the panel leads with. Derived from the loaded accounts (not from the server's copy of the
// counts) so marking an account demo/test moves every number at once.
export function summarize(accounts: UnlockSignupAccount[]) {
  const counted = accounts.filter(isCounted);
  const submitted = counted.filter((account) => account.hasSubmission).length;
  const notSubmitted = counted.filter((account) => !account.hasSubmission);
  const neverBack = notSubmitted.filter(neverReturned).length;
  const views = notSubmitted.map((account) => account.unlockScreenViews).sort((a, b) => a - b);
  return {
    totalAccounts: accounts.length,
    excludedCount: accounts.filter((account) => account.excluded).length,
    deletedCount: accounts.filter((account) => !account.excluded && account.deletedTheirData).length,
    memberCount: counted.length,
    submittedCount: submitted,
    notSubmittedCount: notSubmitted.length,
    neverReturnedCount: neverBack,
    returnedAnywayCount: notSubmitted.length - neverBack,
    // Median rather than mean: one member who reloaded the screen twenty times would drag an average
    // and make the whole group look like it kept trying.
    medianScreenViews: views.length === 0 ? 0 : views[Math.floor(views.length / 2)],
  };
}

// Which accounts each tab shows.
export function accountsForTab(accounts: UnlockSignupAccount[], tab: SignupTab): UnlockSignupAccount[] {
  if (tab === 'not-submitted') return accounts.filter((account) => isCounted(account) && !account.hasSubmission);
  if (tab === 'excluded') return accounts.filter((account) => account.excluded);
  if (tab === 'deleted') return accounts.filter((account) => !account.excluded && account.deletedTheirData);
  return accounts;
}

export function matchesSearch(account: UnlockSignupAccount, query: string): boolean {
  return [account.name, account.username, account.email, account.userId].some(
    (field) => field != null && field.toLowerCase().includes(query),
  );
}
