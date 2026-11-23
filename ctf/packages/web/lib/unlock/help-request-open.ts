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
