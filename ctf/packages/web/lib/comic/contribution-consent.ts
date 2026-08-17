// The consent a contributor gives when they send their Quora writing.
//
// It lives in one module, in code, for a specific reason: the page must display the SAME words that
// the stored record stamps a version against. If the wording lived only in the page's markup, a
// later edit would silently change what every past contributor appears to have agreed to. Here, an
// edit that changes the meaning must also bump CONTRIBUTION_CONSENT_VERSION, and old rows keep
// pointing at the old version.
//
// What this is, in legal shape: a limited, non-exclusive, revocable license. The contributor keeps
// every right to their own writing; they are permitting one use, and they can end it. Each clause
// below states one of those edges in plain words.
//
// HOW TO CHANGE IT: if you alter what a contributor is agreeing to — the use, the scope, the
// revocability — bump the version. Fixing a typo that changes no meaning can keep the version.

export const CONTRIBUTION_CONSENT_VERSION = '2026-07-29.1';

export type ConsentClause = {
  id: string;
  // Shown beside its own checkbox. Every one must be ticked; there is no bundled "I agree to all",
  // because the point is that each is read.
  text: string;
};

export const CONTRIBUTION_CONSENT_CLAUSES: ConsentClause[] = [
  {
    id: 'ownership',
    text: 'This is my own writing, published publicly under my own Quora account.',
  },
  {
    id: 'use',
    text:
      'I permit it to be used as reference material the assistant quotes from when it drafts answers for members of this app — and for nothing else. It will not be sold, published as a dataset, or passed to another company.',
  },
  {
    id: 'keep-rights',
    text:
      'I keep every right to my writing. I am lending it, not signing it over, and I can still use it anywhere else I like.',
  },
  {
    id: 'withdraw',
    text:
      'I understand I can withdraw it at any time, and that it will be taken out of the library when I ask.',
  },
  {
    id: 'human-review',
    text:
      'I understand a person will read what I send, that not everything is used, and that no answer reaches a member without a human reviewing it first.',
  },
  {
    id: 'third-parties',
    text:
      'Where my posts name or describe other people, I understand those parts may be cut, or the post skipped, because those people did not agree to this.',
  },
];

// Shown above the checkboxes. Facts the contributor needs before consenting, not terms to tick.
export const CONTRIBUTION_CONSENT_NOTES: string[] = [
  'Only your public answers and posts are kept. If you send a whole export, everything else Quora bundles into it — your private messages, your unpublished drafts, your profile details — is deleted automatically as soon as it arrives, before any person opens it. You do not have to clean the file yourself.',
  'A file you upload is never stored. It is read once, in memory, and the archive itself is discarded — there is no copy of it sitting anywhere afterwards.',
  'Your words are not used to train a model. They go into a table the assistant searches when it needs them, which is why withdrawing is something that can actually be done: the row comes out and the assistant stops quoting it. A bot trained the usual way could not honestly promise that.',
  'An accepted contribution earns a ServiceCredits grant — an internal credits unit inside this app, not money and never cashable. You need to have finished verifying (Unlock) to receive it. You can contribute before then and your writing is used the same way; the grant simply waits.',
  'Contact details are stripped automatically — email addresses, phone numbers, links, and account handles. This narrows what gets through; it does not replace a person reading it, which is why one does.',
];

// Every clause id, in order — the server checks the submission agreed to all of them, so a client
// that omits one (or an older page with fewer) is rejected rather than silently accepted.
export const REQUIRED_CONSENT_CLAUSE_IDS: string[] = CONTRIBUTION_CONSENT_CLAUSES.map((c) => c.id);

export function hasAgreedToEveryClause(agreedIds: unknown): boolean {
  if (!Array.isArray(agreedIds)) return false;
  const agreed = new Set(agreedIds.filter((value): value is string => typeof value === 'string'));
  return REQUIRED_CONSENT_CLAUSE_IDS.every((id) => agreed.has(id));
}
