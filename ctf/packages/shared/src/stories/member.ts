// Members' own writing as Today stories (3.1.0 plan, Today and + New: Story also takes imported
// writing). The writing is the same rows the Knowledge Library already holds once a person has read
// and accepted them. Showing it on Today is a separate choice from lending it to the library, made by
// the writer for each contribution and stamped with the version of the words below, so a later change
// to those words never changes what an earlier writer agreed to.

// The words a member agrees to now: members and visitors without an account. A choice made under an
// earlier version shows to signed-in members only until the writer agrees again.
export const SE_MEMBER_STORY_CONSENT_VERSION = '2026-11-16.1';
export const SE_MEMBER_STORY_PUBLIC_VERSIONS: readonly string[] = ['2026-11-16.1'];

export function seMemberStoryShownSignedOut(consentVersion: string | null | undefined): boolean {
  return !!consentVersion && SE_MEMBER_STORY_PUBLIC_VERSIONS.includes(consentVersion);
}

export const SE_MEMBER_STORY_WORDS = {
  label: (handle: string) => `Story · from ${handle}`,
  // The sheet's link under a member's story leads to where a member brings their own.
  open: 'Bring your writing',
  toggle: 'Also show it as a story on Today',
  consent:
    'Members and visitors without an account will see it on Today under your handle, a few pieces a day, after a person has read it. You can turn this off at any time, and withdrawing takes it off Today too.',
  agree: 'Agree to the words above',
  agreeAgain: 'You chose this under earlier words that kept it from visitors. Tick the box again to agree to the words above.',
  waitsForUnlock: 'It shows once your Unlock is approved.',
  on: 'Shown as a story on Today',
  off: 'Not shown on Today',
  failed: 'Could not change whether this shows on Today. Nothing was changed. Try again.',
} as const;
