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

// What the database returns when a member presses "ask for help": whether the row was new, its
// timestamps after the write, and whether it was marked done before it.
export type UnlockHelpRequestWrite = {
  inserted: boolean;
  requested_at: Date | string;
  done_at: Date | string | null;
  prev_done_at: Date | string | null;
};

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

// A reference for the request this press opened, or null when the request was already open. A first
// press opens one, and so does a press that reopened a request an admin had marked done. The reference
// names the request by its timestamps only, never by the member.
export function unlockHelpRequestOpenedRef(write: UnlockHelpRequestWrite): string | null {
  const base = `help@${iso(write.requested_at)}`;
  if (write.inserted) return base;
  if (write.prev_done_at && !write.done_at) return `${base}/reopened@${iso(write.prev_done_at)}`;
  return null;
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
