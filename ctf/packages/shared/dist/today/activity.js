// Activity in 3.1, shared by web and Android: what needs an answer from the member, then what
// happened, newest first. Read from the app's notifications (GET /api/notifications). No red badges:
// an unread item reads "New" in the theme's own colors.
export const SE_ACTIVITY_WORDS = {
    loading: 'Reading Activity…',
    answer: 'Needs your answer',
    happened: 'What happened',
    isNew: 'New',
    empty: 'Nothing yet. Replies, credits sent to you and confirmations show here.',
    failed: 'Could not read Activity.',
    tryAgain: 'Try again',
    allRead: 'Mark all as read',
};
// Kinds that ask the member to do something: a Recurring Activity invite waits for confirm or decline.
const ANSWER_TYPES = ['recurring-activity.invited'];
export function seActivityView(items) {
    const sorted = [...items].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    return {
        answer: sorted.filter((item) => ANSWER_TYPES.includes(item.notificationType) && !item.isRead),
        happened: sorted.filter((item) => !(ANSWER_TYPES.includes(item.notificationType) && !item.isRead)),
    };
}
// "Just now", "5 min ago", "3 h ago", "2 days ago", then the date.
export function seAgo(iso, now = new Date()) {
    const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
    if (minutes < 1)
        return 'Just now';
    if (minutes < 60)
        return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7)
        return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
