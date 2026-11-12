// How long a card stays on Today (owner decisions, 2026-11-03), shared by web and Android: the words
// for the deadline asked in + New, for closing and renewing an ask or offer, and for the notice on
// day 14. Leaving Today never closes or deletes anything; every item stays in its own part of the app.
// The rules themselves run on the server in ctf/packages/web/lib/today/lifetime.ts.
export const SE_TODAY_ASK_DAYS = 14;
export const SE_TODAY_STORY_DAYS = 7;
export const SE_ASK_DUE_CHOICES = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This week' },
    { key: 'date', label: 'A date' },
    { key: 'none', label: 'No deadline' },
];
export const SE_CARD_LIFETIME_WORDS = {
    byWhen: 'By when?',
    byWhenHint: 'With no deadline, the ask stays on Today for 14 days, and you can keep it up longer.',
    date: 'The date',
    dateMissing: 'Pick the date, or choose another answer.',
    yours: 'You posted this',
    close: 'Close it',
    done: 'Done',
    notDone: 'Closed, not done',
    closing: 'Closing…',
    closed: 'Closed. It has left Today.',
    closeFailed: 'Could not close it.',
    // Done on an ask somebody offered to help with: the poster picks who did it, and that member
    // receives the day's credit when the card carries it.
    whoDidIt: 'Who did it?',
    back: 'Back',
    renew: 'Keep it up for 14 more days',
    renewing: 'Keeping it up…',
    renewed: 'Kept up on Today for 14 more days.',
    renewFailed: 'Could not keep it up.',
    askNotice: 'Still need this? Keep it up for 14 more days',
    offerNotice: 'Still offering this? Keep it up for 14 more days',
};
// The Activity notice's type, and the one tap that answers it.
export const SE_TODAY_RENEW_NOTICE = 'today.renew';
// "On Today until Nov 17", in the reader's own timezone.
export function seOnTodayUntil(iso) {
    return `On Today until ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
function endOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
// The moment a deadline answer means, in the poster's own timezone: the end of today, the end of
// this Sunday, or the end of the date picked. Null for no deadline, and for a date that is missing,
// unreadable or already over.
export function seAskDueIso(choice, date, now = new Date()) {
    if (choice === 'today')
        return endOfLocalDay(now).toISOString();
    if (choice === 'week') {
        const toSunday = (7 - now.getDay()) % 7;
        return endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + toSunday)).toISOString();
    }
    if (choice !== 'date' || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        return null;
    const [year, month, day] = date.split('-').map(Number);
    const end = endOfLocalDay(new Date(year, month - 1, day));
    return Number.isNaN(end.getTime()) || end.getTime() < now.getTime() ? null : end.toISOString();
}
// The card id a day-14 notice renews, carried in its link as `renew=<card id>`; null for any other
// notice.
export function seRenewCardId(item) {
    if (item.notificationType !== SE_TODAY_RENEW_NOTICE || !item.linkPath)
        return null;
    const query = item.linkPath.split('?')[1] ?? '';
    for (const part of query.split('&')) {
        const [key, value] = part.split('=');
        if (key === 'renew' && value) {
            try {
                return decodeURIComponent(value);
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
export function seRenewLink(href, cardId) {
    return `${href}${href.includes('?') ? '&' : '?'}renew=${encodeURIComponent(cardId)}`;
}
