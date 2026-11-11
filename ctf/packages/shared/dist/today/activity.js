// Activity in 3.1, shared by web and Android (approved board "Activity"): what needs the member,
// then what happened today, then earlier, each with its full date and time in the reader's own
// timezone. Read from the app's notifications (GET /api/notifications). A notice that waits on the
// member carries its answer inline: confirm or decline a Recurring Activity invite, agree to a Just
// us two request on a Today card, or keep an ask or offer up 14 more days.
import { SE_CARD_LIFETIME_WORDS as L, seRenewCardId } from './lifetime';
export const SE_ACTIVITY_WORDS = {
    loading: 'Reading Activity…',
    needs: 'Needs you',
    today: 'Today',
    earlier: 'Earlier',
    empty: 'Nothing yet. Replies, credits sent to you and confirmations show here.',
    failed: 'Could not read Activity.',
    tryAgain: 'Try again',
    end: 'That is everything. Notifications are quiet unless you turn them up in Me.',
};
export const SE_RECURRING_INVITE_NOTICE = 'recurring-activity.invited';
export const SE_PAIR_REQUEST_NOTICE = 'today.card.pair_request';
// The target of a Just us two request notice: the card and the member who asked.
export function seActivityPairRef(cardId, requesterId) {
    return `${cardId}|${requesterId}`;
}
function readPairRef(ref) {
    const at = ref ? ref.lastIndexOf('|') : -1;
    if (!ref || at <= 0 || at === ref.length - 1)
        return null;
    return { cardId: ref.slice(0, at), partnerId: ref.slice(at + 1) };
}
const card = (cardId, path) => `/api/today/cards/${encodeURIComponent(cardId)}/${path}`;
const activity = (id, path) => `/api/recurring-activity/${encodeURIComponent(id)}/${path}`;
function recurringNeed(item) {
    if (!item.targetRef)
        return null;
    return {
        item,
        partnerId: null,
        buttons: [
            { label: 'Confirm', busy: 'Confirming…', done: 'Confirmed.', failed: 'Could not confirm it.', look: 'raised', path: activity(item.targetRef, 'confirm'), body: {} },
            { label: "That's not right", busy: 'Sending…', done: 'Declined. It will not be counted.', failed: 'Could not decline it.', look: 'quiet', path: activity(item.targetRef, 'decline'), body: {} },
        ],
    };
}
function pairNeed(item) {
    const ref = readPairRef(item.targetRef);
    if (!ref)
        return null;
    return {
        item,
        partnerId: ref.partnerId,
        buttons: [
            {
                label: 'Agree',
                busy: 'Agreeing…',
                done: 'Agreed. Open the card in Today to talk just you two.',
                failed: 'Could not agree.',
                look: 'primary',
                path: card(ref.cardId, 'pair/agree'),
                body: { partnerId: ref.partnerId },
            },
            { label: 'Not now', busy: 'Not now', done: '', failed: '', look: 'quiet', path: null, body: {} },
        ],
    };
}
function renewNeed(item) {
    const cardId = seRenewCardId(item);
    if (!cardId)
        return null;
    return { item, partnerId: null, buttons: [{ label: L.renew, busy: L.renewing, done: L.renewed, failed: L.renewFailed, look: 'raised', path: card(cardId, 'renew'), body: {} }] };
}
// The inline answer an unread notice waits on, or null for a notice that only tells.
export function seActivityNeed(item) {
    if (item.isRead || item.answer)
        return null;
    if (item.notificationType === SE_RECURRING_INVITE_NOTICE)
        return recurringNeed(item);
    if (item.notificationType === SE_PAIR_REQUEST_NOTICE)
        return pairNeed(item);
    return renewNeed(item);
}
// The line under a day-14 notice that was already answered: "Kept up on Today for 14 more days." or
// "Closed. It has left Today."; null otherwise.
export function seActivityOutcome(item) {
    if (item.answer === 'kept')
        return L.renewed;
    if (item.answer === 'closed')
        return L.closed;
    return null;
}
function sameLocalDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
// Newest first. A notice waiting on the member is in Needs you; the rest split into today (the
// reader's own calendar day) and earlier.
export function seActivityView(items, now = new Date()) {
    const sorted = [...items].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    const view = { needs: [], today: [], earlier: [] };
    for (const item of sorted) {
        const need = seActivityNeed(item);
        if (need)
            view.needs.push(need);
        else if (sameLocalDay(new Date(item.createdAtIso), now))
            view.today.push(item);
        else
            view.earlier.push(item);
    }
    return view;
}
// "October 26, 2026 at 1:12 PM CDT", in the reader's own timezone.
export function seActivityWhen(iso) {
    const at = new Date(iso);
    const date = at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    return `${date} at ${time}`;
}
export const SE_ACTIVITY_ICON_PATHS = {
    reply: 'M4 5h16v11H8l-4 4z',
    check: 'M5 12l5 5 9-10',
    calendar: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
    star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.3l6-.7z',
};
export const SE_ACTIVITY_ICON_KIND = { reply: 'ask', check: 'offer', calendar: 'match', star: 'story' };
const CHECK_TYPES = [
    'service-credits.received',
    'recurring-activity.confirmed',
    'peer-programming.goal.task-finished',
    'skill-up.milestone.released',
    'socket-relay.request.claimed',
    'trust-transport.offer.accepted',
];
const CALENDAR_TYPES = [SE_RECURRING_INVITE_NOTICE, 'recurring-activity.declined', 'today.renew'];
const STAR_TYPES = ['comic.answer.published'];
export function seActivityIcon(notificationType) {
    if (CHECK_TYPES.includes(notificationType))
        return 'check';
    if (CALENDAR_TYPES.includes(notificationType))
        return 'calendar';
    if (STAR_TYPES.includes(notificationType))
        return 'star';
    return 'reply';
}
function mixHex(a, b, share) {
    const channel = (hex, i) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const out = [0, 1, 2].map((i) => Math.round(channel(a, i) * share + channel(b, i) * (1 - share)));
    return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
// The icon circle: the kind's color, lightly, over the card color, so it reads in all four colors
// and both modes.
export function seActivityTint(t, icon) {
    return mixHex(t.kind[SE_ACTIVITY_ICON_KIND[icon]], t.card, 0.2);
}
// "Just now", "5 min ago", "3 h ago", "2 days ago", then the date. Used beside messages on a card
// and in the Architect's answers; Activity itself shows the full date and time.
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
