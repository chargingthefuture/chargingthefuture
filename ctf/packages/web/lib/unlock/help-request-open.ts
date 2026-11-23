// Whether a member's "ask for help" request still waits on an admin, shared by the sign-ups panel on
// /admin/unlock and the Unlock tile's dot on the admin landing (owner decision, 2026-11-23). Pure, so
// the panel can apply it to a row it has just changed.

// A help request as the panel shows it: every request, with or without anything typed in the box.
export type UnlockHelpRequestFact = { requestedAt: string; quoraHint: string | null; doneAt: string | null };

// A request is handled once the member's address was approved or turned down (spam and duplicate are
// turned down too), or an admin pressed Done on the row.
export const UNLOCK_HELP_SETTLED_STATUSES: readonly string[] = ['approved', 'rejected', 'spam', 'duplicate'];

export function isUnlockHelpRequestOpen(fact: Pick<UnlockHelpRequestFact, 'doneAt'> | null, reviewStatus: string | null): boolean {
  if (!fact || fact.doneAt) return false;
  return !(reviewStatus && UNLOCK_HELP_SETTLED_STATUSES.includes(reviewStatus));
}

// The sign-ups still waiting on help, oldest request first, for the line at the top of /admin/unlock
// that says why the tile has its dot.
export function openUnlockHelpRequests<T extends { helpRequestOpen: boolean; helpRequestedAt: string | null }>(accounts: readonly T[]): T[] {
  return accounts
    .filter((account) => account.helpRequestOpen)
    .sort((a, b) => (a.helpRequestedAt ?? '').localeCompare(b.helpRequestedAt ?? ''));
}

export function unlockHelpRequestsHeadline(count: number): string {
  return count === 1 ? '1 person asked for help' : `${count} people asked for help`;
}
