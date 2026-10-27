// Where a signed-in member stands with Unlock in 3.1, shared by web and Android (plan: Access).
// The app is open from day 1 to day 14. In the second week the banner cannot be closed. After day
// 14, posting, answering and credits pause until Unlock is done; Mood, ClickLog, reading, rooms, the
// account and bug reports stay open. The count stops once the member sends their address or asks
// for help finding it. Not finishing never removes an account.
export const SE_UNLOCK_OPEN_DAYS = 14;
export const SE_UNLOCK_WORDS = {
    routes: 'Finish Unlock by sending your Quora profile address, or ask for help finding it. The System Architect approves each, usually within a day. Everything stays open for 14 days; after that, posting pauses until it is done.',
    sentTitle: 'Sent. Waiting for approval.',
    sentText: 'The System Architect approves each, usually within a day. Everything stays open while you wait.',
    pausedTitle: 'Posting is paused until Unlock is done.',
    pausedText: 'Mood, ClickLog, reading, rooms, your account and bug reports stay open. Your account is never removed for this.',
    open: 'Finish Unlock',
    help: 'Ask for help finding it',
    close: 'Close',
    href: '/plugin/unlock',
};
const DAY_MS = 86_400_000;
export function seUnlockDay(firstSeenIso, now = new Date()) {
    if (!firstSeenIso)
        return 1;
    return Math.max(1, Math.floor((now.getTime() - Date.parse(firstSeenIso)) / DAY_MS) + 1);
}
export function seUnlockStanding(input, now = new Date()) {
    const day = seUnlockDay(input.firstSeenIso, now);
    if (input.approved)
        return { approved: true, day, paused: false, closable: true, title: '', text: '' };
    if (input.countStopped) {
        return { approved: false, day, paused: false, closable: true, title: SE_UNLOCK_WORDS.sentTitle, text: SE_UNLOCK_WORDS.sentText };
    }
    if (day > SE_UNLOCK_OPEN_DAYS) {
        return { approved: false, day, paused: true, closable: false, title: SE_UNLOCK_WORDS.pausedTitle, text: `${SE_UNLOCK_WORDS.pausedText} ${SE_UNLOCK_WORDS.routes}` };
    }
    return {
        approved: false,
        day,
        paused: false,
        closable: day <= SE_UNLOCK_OPEN_DAYS / 2,
        title: `Day ${day} of ${SE_UNLOCK_OPEN_DAYS}`,
        text: SE_UNLOCK_WORDS.routes,
    };
}
