// Save for later on Today (approved 3.1 board): a story or a replay a member keeps to come back to.
// Stored on the server per member (today_card_saves) with the card's title, kind and address, so the
// Saved list in Me still works after the card has left Today. Saving does not change how long a card
// stays on Today; Saved is a list of its own. Shared by web and Android and by the route.
export const SE_SAVES_MAX = 200;
const SAVE_KINDS = new Set(['story', 'replay']);
const CARD_ID = /^[a-z][a-z0-9-]{0,39}:\S{1,200}$/;
const TITLE_MAX = 300;
const HREF_MAX = 1000;
export function seCanSave(card) {
    return SAVE_KINDS.has(card.kind);
}
// A link inside the app, or an https address (a blog post, a replay). Nothing else is kept.
function safeHref(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > HREF_MAX)
        return null;
    if (value.startsWith('/') && !value.startsWith('//'))
        return value;
    return value.startsWith('https://') ? value : null;
}
function readSaved(raw, cardId) {
    if (typeof raw.kind !== 'string' || !SAVE_KINDS.has(raw.kind))
        return null;
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, TITLE_MAX) : '';
    const href = safeHref(raw.href);
    return title && href ? { cardId, saved: true, kind: raw.kind, title, href } : null;
}
export function seParseSaveChange(body) {
    if (!body || typeof body !== 'object')
        return null;
    const raw = body;
    if (typeof raw.cardId !== 'string' || !CARD_ID.test(raw.cardId))
        return null;
    if (raw.saved === false)
        return { cardId: raw.cardId, saved: false };
    return raw.saved === true ? readSaved(raw, raw.cardId) : null;
}
// The change a tap on Save for later asks for: save it, or take it off the list when already saved.
export function seSaveChangeFor(card) {
    if (card.saved)
        return { cardId: card.id, saved: false };
    return { cardId: card.id, saved: true, kind: card.kind, title: card.title, href: card.href };
}
// The screen's own copy of a change, drawn at once while the route stores it.
export function seSaveCardInToday(today, change) {
    return { ...today, cards: today.cards.map((card) => (card.id === change.cardId ? { ...card, saved: change.saved } : card)) };
}
const KIND_NAMES = { story: 'Story', replay: 'Replay' };
export function seSavedKindName(kind) {
    return KIND_NAMES[kind] ?? 'Card';
}
export const SE_SAVED_WORDS = {
    title: 'Saved',
    intro: 'Stories and replays you saved from Today.',
    empty: 'Nothing saved yet. Tap Save for later on a story or a replay to keep it here.',
    save: 'Save for later',
    unsave: 'Saved. Tap to remove from Saved',
    hide: 'Hide',
    remove: 'Remove',
    failed: 'Saved could not be changed:',
    loadFailed: 'Saved could not be loaded:',
    full: `Saved holds up to ${SE_SAVES_MAX} cards. Remove one in Me to save another.`,
};
