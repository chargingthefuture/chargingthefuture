// The member's own marks on Today cards (owner decisions, 2026-11-03), stored on the server per
// member (today_card_marks) so every phone and browser agrees: Done (the timeline dot) and Not for me
// (the card's ••• menu). The server applies them to each Today read with seApplyCardMarks:
// - A card marked Not for me never comes back.
// - A card marked done stays on Today the day it was marked and leaves from the member's next day.
//   A story or replay brought round again by its daily rotation stays off once done, except a blog
//   story whose Fireside conversation has a comment newer than the mark: it comes back, not done,
//   with "N new comments".
// A visitor who is not signed in has no account, so their marks stay on their device only
// (SeTodayMarks, seTodayView).
const CARD_ID = /^[a-z][a-z0-9-]{0,39}:.{1,200}$/;
export const SE_CARD_MARKS_MAX_BATCH = 500;
function readChange(value) {
    if (!value || typeof value !== 'object')
        return null;
    const { cardId, mark } = value;
    if (typeof cardId !== 'string' || cardId.length > 241 || !CARD_ID.test(cardId))
        return null;
    return mark === 'done' || mark === 'not_for_me' || mark === 'clear' ? { cardId, mark } : null;
}
// One change `{ cardId, mark }`, or a batch `{ marks: [...] }` (the one-time upload of marks a device
// kept before they were stored on the account). Null when anything in it is unreadable.
export function seParseCardMarkChanges(body) {
    const list = body?.marks;
    if (Array.isArray(list)) {
        if (list.length === 0 || list.length > SE_CARD_MARKS_MAX_BATCH)
            return null;
        const changes = list.map(readChange);
        return changes.every(Boolean) ? changes : null;
    }
    const one = readChange(body);
    return one ? [one] : null;
}
// Marks a device kept before they were stored on the account, as the changes that upload them once.
export function seLegacyMarkChanges(saved) {
    const raw = (saved && typeof saved === 'object' ? saved : {});
    const ids = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string' && CARD_ID.test(id)) : []);
    const hidden = ids(raw.hidden);
    const done = ids(raw.read).filter((id) => !hidden.includes(id));
    return [...hidden.map((cardId) => ({ cardId, mark: 'not_for_me' })), ...done.map((cardId) => ({ cardId, mark: 'done' }))].slice(-SE_CARD_MARKS_MAX_BATCH);
}
// How many comments anybody can read were written under a story since it was marked done.
export function seNewCommentsSince(card, markedAtIso) {
    const since = Date.parse(markedAtIso);
    return (card.commentTimesIso ?? []).filter((iso) => Date.parse(iso) > since).length;
}
export function seNewCommentsLine(count) {
    if (!count || count <= 0)
        return null;
    return count === 1 ? '1 new comment' : `${count} new comments`;
}
function applyOne(card, mark, dayStartMs) {
    const { commentTimesIso: _times, ...shown } = card;
    if (!mark)
        return shown;
    if (mark.mark === 'not_for_me')
        return null;
    const fresh = seNewCommentsSince(card, mark.markedAtIso);
    if (fresh > 0)
        return { ...shown, newComments: fresh };
    if (Date.parse(mark.markedAtIso) < dayStartMs)
        return null;
    return { ...shown, markedDoneAtIso: mark.markedAtIso };
}
// The member's marks applied to a Today read. `dayStartIso` is the start of the member's own day.
// Comment times are used here and left out of what is sent.
export function seApplyCardMarks(cards, marks, dayStartIso) {
    const byId = new Map(marks.map((mark) => [mark.cardId, mark]));
    const dayStartMs = Date.parse(dayStartIso);
    return cards.map((card) => applyOne(card, byId.get(card.id), dayStartMs)).filter((card) => card !== null);
}
// Shown as done: done on the server (a 21 Questions answer) or marked done by the member.
export function seCardShownDone(card) {
    return Boolean(card.done || card.markedDoneAtIso);
}
// The screen's own copy of a change, drawn at once while the route stores it.
export function seMarkCardInToday(today, change, now = new Date()) {
    if (change.mark === 'not_for_me')
        return { ...today, cards: today.cards.filter((card) => card.id !== change.cardId) };
    return {
        ...today,
        cards: today.cards.map((card) => {
            if (card.id !== change.cardId)
                return card;
            const { markedDoneAtIso: _was, newComments: _new, ...rest } = card;
            return change.mark === 'done' ? { ...rest, markedDoneAtIso: now.toISOString() } : rest;
        }),
    };
}
// The start of the member's own day, sent with the Today read so done cards leave from their next day.
export function seDayStartIso(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}
// The marks the screen draws for a signed-in member, read from the cards themselves.
export function seMarksFromToday(today) {
    return { read: (today?.cards ?? []).filter(seCardShownDone).map((card) => card.id), hidden: [] };
}
// What a tap asks the server for: Not for me, or the timeline dot (done, or Done taken away). Null on
// a card the server marks done itself (a 21 Questions answer), which the dot does not change.
export function seMarkChangeFor(today, kind, cardId) {
    if (kind === 'hidden')
        return { cardId, mark: 'not_for_me' };
    const card = today?.cards.find((item) => item.id === cardId);
    if (!card || card.done)
        return null;
    return { cardId, mark: card.markedDoneAtIso ? 'clear' : 'done' };
}
