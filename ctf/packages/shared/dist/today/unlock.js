// Where a signed-in member stands with Unlock in 3.1, shared by web and Android (plan: Access).
// The app is open from day 1 to day 14. In the second week the banner cannot be closed. After day
// 14, posting, answering and credits pause until Unlock is done; Mood, ClickLog, reading, rooms, the
// account and bug reports stay open. The count stops once the member sends their address or asks
// for help finding it. Not finishing never removes an account.
export const SE_UNLOCK_OPEN_DAYS = 14;
// The two other ways to finish, for a member whose Quora account was removed, worded the same on the
// banner and the Unlock screen: three sentences, the census and the Knowledge Library as links.
export const SE_UNLOCK_OTHER_ROUTES_WORDS = {
    censusLead: 'Add it to the',
    census: 'Quora account removals survey',
    censusTail: '.',
    knowledgeLead: 'Or bring your Quora writing into the',
    knowledge: 'Knowledge Library',
    knowledgeTail: ' with its profile address.',
    eitherUnlocks: 'Either option unlocks your account.',
    censusHref: '/survey/quora-account-deletions',
    knowledgeHref: '/knowledge',
};
// The words of the banner, from the approved 3.1 boards "Unlock banner, day 9 of 14" and "After the
// Unlock deadline". The approval grant is set by an admin, so the banner names no number of credits.
export const SE_UNLOCK_WORDS = {
    openTitle: 'Add your Quora profile address to finish Unlock',
    openText: 'People and your credits open once the System Architect reviews it and you are approved, usually within a day. After day 14, posting, answering and credits pause until you add it. Mood, your private log, reading, rooms and your account stay open.',
    sentTitle: 'Sent. In review.',
    sentText: 'The System Architect reviews each, usually within a day. Everything stays open while you wait.',
    helpSentTitle: 'Help request sent.',
    helpSentText: 'A person will look you up on Quora, usually within a day. You can still add your address on the Unlock screen. Everything stays open while you wait.',
    pausedTitle: 'Posting is paused until you finish Unlock',
    pausedText: 'Your account is untouched. Reading, rooms as a listener, Mood, your private log and everything in Me stay open. Posting, answering and credits come back the moment your address is in.',
    label: 'Profile address',
    pausedLabel: 'Quora profile address',
    placeholder: 'https://www.quora.com/profile/…',
    add: 'Add',
    adding: 'Adding…',
    addFailed: 'That did not go through. Try again.',
    removedLead: 'Quora removed your account?',
    ...SE_UNLOCK_OTHER_ROUTES_WORDS,
    countLine: 'The count stops once you send the address or ask for help finding it.',
    why: 'Why this step',
    cantFind: "Can't find it?",
    askArchitect: "Can't find it? Ask the architect",
    asking: 'Asking…',
    close: 'Close',
};
const DAY_MS = 86_400_000;
export function seUnlockDay(firstSeenIso, now = new Date()) {
    if (!firstSeenIso)
        return 1;
    return Math.max(1, Math.floor((now.getTime() - Date.parse(firstSeenIso)) / DAY_MS) + 1);
}
export function seUnlockStanding(input, now = new Date()) {
    const day = seUnlockDay(input.firstSeenIso, now);
    const quiet = { approved: input.approved, day, dayLabel: '', progress: 0, paused: false, form: false, title: '', text: '' };
    if (input.approved)
        return { ...quiet, closable: true };
    if (input.countStopped && input.helpOnly)
        return { ...quiet, closable: true, title: SE_UNLOCK_WORDS.helpSentTitle, text: SE_UNLOCK_WORDS.helpSentText };
    if (input.countStopped)
        return { ...quiet, closable: true, title: SE_UNLOCK_WORDS.sentTitle, text: SE_UNLOCK_WORDS.sentText };
    if (day > SE_UNLOCK_OPEN_DAYS) {
        return { ...quiet, paused: true, closable: false, form: true, title: SE_UNLOCK_WORDS.pausedTitle, text: SE_UNLOCK_WORDS.pausedText };
    }
    return {
        ...quiet,
        dayLabel: `Day ${day} of ${SE_UNLOCK_OPEN_DAYS}`,
        progress: day / SE_UNLOCK_OPEN_DAYS,
        closable: day <= SE_UNLOCK_OPEN_DAYS / 2,
        form: true,
        title: SE_UNLOCK_WORDS.openTitle,
        text: SE_UNLOCK_WORDS.openText,
    };
}
