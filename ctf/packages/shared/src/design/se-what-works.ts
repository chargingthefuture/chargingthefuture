// What Works in 3.1: adding a problem (search first, then add) and the admin review of new
// problems, to the approved boards "What works: add a problem" and "What works: admin merge and
// spam". Adding a problem opens from the What works card on Today, on web and Android, in the
// 3.1 look, and Use this or Add what helped goes on to "What helped" in the same sheet, so the work
// stays in 3.1. The 3.0 What Works page opens the same sheet in its own 3.0 look and uses its own
// suggest form. The admin review lives on the 3.0 admin page; 3.1 has no admin pages.

export const SE_WW_ADD_HREF = '/apps/what-works?add=problem';

// The Today card whose opened sheet offers "Add a problem".
export function seWwAddsFrom(source: string): boolean {
  return source === 'what-works';
}

export function seWwHelpedCount(n: number): string {
  if (n === 0) return 'Nothing added yet';
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'thing' : 'things'} that helped`;
}

// The What Works card opened on Today: the solution's own link under the problem, then Add a
// solution to this problem first and Add a problem after it.
export const SE_WW_CARD_WORDS = {
  link: 'Where to get it',
  addSolution: 'Add a solution to this problem',
} as const;

// The solution's link as the card shows it: an https or http address, or nothing.
export function seWwCardLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

export const SE_WW_ADD_WORDS = {
  eyebrow: 'What works',
  title: 'Add a problem',
  close: 'Close',
  rule: 'Check the list first. A problem that is already here gets merged into it, and what you add moves there. Every problem is read before it shows.',
  label: 'The problem, in a few words',
  matchesLabel: 'Already here. Is it one of these?',
  searching: 'Looking for problems already here…',
  noMatches: 'Nothing on the list shares those words.',
  matchesFailed: (reason: string) => `Could not check the list (${reason}). You can still add it.`,
  useThis: 'Use this',
  addIt: 'None of these, add it',
  addItEmpty: 'Add it',
  sending: 'Adding…',
  tooShort: 'Type a few words first.',
  sentTitle: 'Sent for review',
  sent: 'It shows on the list once it is read. Add what helped with it now, and it moves with the problem if it is merged.',
  addWhatHelped: 'Add what helped',
  done: 'Done',
  waiting: (title: string) => `${title} (waiting for review)`,
} as const;

// "What helped", the step after Use this or Add what helped in the sheet opened from Today: the same
// fields and words as the 3.0 suggest form, sent to the same route.
export const SE_WW_HELPED_WORDS = {
  title: 'What helped',
  forProblem: (title: string) => `Problem it solves: ${title}`,
  name: 'Product name',
  link: 'Direct purchase link',
  note: 'Why it works (optional)',
  send: 'Submit for review',
  sending: 'Submitting…',
  failed: 'Could not submit. Try again.',
  sentTitle: 'Suggestion submitted',
  sent: 'A reviewer will check it before it joins the shared list.',
  done: 'Done',
} as const;

export type SeWwHelpedDraft = { problemId: string; name: string; purchaseUrl: string; note: string };

// The request body for a "What helped" suggestion, trimmed, as the 3.0 suggest form sends it.
export function seWwHelpedBody(draft: SeWwHelpedDraft): SeWwHelpedDraft {
  return { problemId: draft.problemId, name: draft.name.trim(), purchaseUrl: draft.purchaseUrl.trim(), note: draft.note.trim() };
}

// Submit is offered once a name and a link are typed; the route checks the rest and says why.
export function seWwHelpedReady(draft: SeWwHelpedDraft): boolean {
  return draft.name.trim().length > 0 && draft.purchaseUrl.trim().length > 0;
}

export const SE_WW_ADMIN_WORDS = {
  eyebrow: 'System Architect · What works',
  title: (n: number) => `New problems · ${n.toLocaleString('en-US')}`,
  loading: 'Reading new problems…',
  empty: 'Nothing new to read.',
  looksLike: 'Looks like:',
  mergeInto: 'Merge into',
  mergeIntoMenu: 'Merge into…',
  merge: 'Merge',
  approve: 'Approve as new',
  spam: 'Delete as spam',
  noMatch: 'no close match',
  attached: (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'thing' : 'things'} that helped attached`,
  allProblems: 'All problems · merge two that already show',
  allTitle: 'Merge two problems',
  allText: 'Everything under the first, and every vote on it, moves to the second. The first is removed.',
  mergeFrom: 'This problem',
  mergeTo: 'Goes into',
  choose: 'Choose…',
  mergeTwo: 'Merge them',
  merged: (moved: number) => `Merged. ${moved.toLocaleString('en-US')} ${moved === 1 ? 'thing' : 'things'} that helped moved.`,
  hideAll: 'Hide',
  failed: 'The change could not be saved.',
} as const;

// The line under a new problem's title: when it was sent, what the proposer added, and whether a
// listed problem looks like it.
export function seWwPendingMeta(sent: string, attachedCount: number, hasMatch: boolean): string {
  const parts = [`Sent ${sent}`];
  if (attachedCount > 0) parts.push(SE_WW_ADMIN_WORDS.attached(attachedCount));
  if (!hasMatch) parts.push(SE_WW_ADMIN_WORDS.noMatch);
  return parts.join(' · ');
}
