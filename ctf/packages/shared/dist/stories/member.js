// Members' own writing as Today stories (3.1.0 plan, Today and + New: Story also takes imported
// writing). The writing is the same rows the Knowledge Library already holds once a person has read
// and accepted them. Showing it on Today is a separate choice from lending it to the library, made by
// the writer for each contribution and stamped with the version of the words below, so a later change
// to those words never changes what an earlier writer agreed to.
export const SE_MEMBER_STORY_CONSENT_VERSION = '2026-11-12.1';
export const SE_MEMBER_STORY_WORDS = {
    label: (handle) => `Story · from ${handle}`,
    // The sheet's link under a member's story leads to where a member brings their own.
    open: 'Bring your writing',
    toggle: 'Also show it as a story on Today',
    consent: 'Signed-in members will see it on Today under your handle, a few pieces at a time, after a person has read it. It is never shown to visitors who are not signed in. You can turn this off at any time, and withdrawing takes it off Today too.',
    waitsForUnlock: 'It shows once your Unlock is approved.',
    on: 'Shown as a story on Today',
    off: 'Not shown on Today',
    failed: 'Could not change whether this shows on Today. Nothing was changed. Try again.',
};
