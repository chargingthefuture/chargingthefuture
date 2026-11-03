// Card conversations in 3.1, shared by web and Android: a Today card of kind ask, offer or story
// opens in place as a sheet with the people who answered it, a public conversation, and "Just us
// two", a private conversation between two members on that card that opens once both agree.
// One store serves every such card, keyed by the card id (`SeTodayCard.id`, e.g.
// `trust-transport:123`), so asks, offers and stories all work the same.
// Built on the server by ctf/packages/web/lib/today/cards/; drawn by web
// components/se-frame/today/card-sheet*.tsx and Android src/features/se-frame/today/CardSheet*.tsx.
export const SE_CARD_ANSWER_KINDS = ['help', 'know-someone', 'want', 'helped-me'];
export const SE_CARD_MESSAGE_MAX = 1000;
export const SE_CARD_ID_MAX = 200;
// `${source}:${sourceId}`: a lower-case source name, a colon, then the source's own id with no
// spaces (some are addresses, so they carry colons and slashes of their own).
const CARD_ID = /^[a-z][a-z0-9-]{0,39}:\S{1,200}$/;
// 21 Questions keeps its own controls inside the card and never opens a sheet.
const OWN_CONTROLS = new Set(['questions', 'questions-match']);
export function seCardIdValid(id) {
    if (id.length > SE_CARD_ID_MAX || !CARD_ID.test(id))
        return false;
    return !OWN_CONTROLS.has(id.slice(0, id.indexOf(':')));
}
const SHEET_KINDS = new Set(['ask', 'offer', 'story']);
// Whether tapping the card's text opens the sheet; every other card keeps expanding in place.
export function seCardOpensSheet(card) {
    return SHEET_KINDS.has(card.kind) && !OWN_CONTROLS.has(card.source);
}
export function seCardAnswerKind(kind) {
    return SE_CARD_ANSWER_KINDS.includes(kind) ? kind : null;
}
// The two account ids of a Just us two conversation, lower first, so one pair has one key.
export function seCardPair(a, b) {
    return a < b ? [a, b] : [b, a];
}
const ANSWER_WORDS = {
    help: 'can help',
    'know-someone': 'knows someone',
    want: 'would like this',
    'helped-me': 'says this helped',
};
const KIND_WORDS = { ask: 'Ask', offer: 'Offer', story: 'Story' };
// Where each source's item lives, for the "Open in …" link in the sheet.
const SOURCE_NAMES = {
    'peer-programming': 'PeerProgramming',
    'socket-relay': 'SocketRelay',
    'trust-transport': 'TrustTransport',
    'skills-hunt': 'SkillsHunt',
    'skills-hunt-mission': 'SkillsHunt',
    lighthouse: 'LightHouse',
    'skill-up': 'SkillUp',
    'what-works': 'WhatWorks',
    'blog-story': 'the blog',
    'directory-invite': 'the Directory',
    'quora-survey': 'the survey',
};
export const SE_CARD_WORDS = {
    answered: (count) => (count === 1 ? '1 person answered' : `${count} people answered`),
    answerLine: (kinds) => kinds.map((kind) => ANSWER_WORDS[kind]).join(', '),
    talkHere: 'Talk here',
    conversation: 'Conversation',
    whoReads: 'Who can read it',
    public: 'Public',
    pair: 'Just us two',
    composer: 'Write in this card',
    send: 'Send',
    publicHint: 'Everyone can read this. Just us two opens once you both agree.',
    pairHint: (handle) => `Only you and ${handle} can read this.`,
    pairNone: 'Nobody is talking just you two yet. Tap Talk here next to somebody, or Just us two under a message.',
    waiting: (handle) => `Waiting for ${handle} to agree`,
    askedMe: (handle) => `${handle} asked to talk just you two`,
    agree: 'Agree',
    askPair: 'Just us two',
    noMessages: 'No messages yet. Say what you can do, or ask what you need to know.',
    noPairMessages: 'Nothing here yet. Times, places and details go here.',
    unlockLine: 'Writing in a card opens once Unlock is done.',
    pausedLine: 'Writing in a card is paused until Unlock is done. Reading stays open, and your account is never removed for this.',
    loading: 'Loading the conversation…',
    share: 'Share',
    linkCopied: 'Link copied',
    more: 'More: report',
    report: 'Report',
    notForMe: 'Not for me',
    reportMessage: 'Report this message',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edited: 'Edited',
    editLabel: 'Change your message',
    deleteConfirm: 'Delete this message? It is removed for everyone and cannot be brought back.',
    reported: 'Reported. An admin reads every report.',
    close: 'Close',
    openIn: (source) => (SOURCE_NAMES[source] ? `Open in ${SOURCE_NAMES[source]}` : 'Open where it lives'),
    you: 'You',
};
// "Ask · October 26, 2026 at 11:40 AM CDT", the line under the author in the sheet.
export function seCardSheetLine(card) {
    const at = new Date(card.createdAtIso);
    const day = at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    const kind = KIND_WORDS[card.kind] ?? card.label.split(' · ')[0];
    return `${kind} · ${day} at ${time}`;
}
// The line a card shows when a write is refused for Unlock: not approved yet (cards closed before
// Unlock), or paused after day 14. Null for any other refusal.
export function seCardLockLine(reason) {
    if (reason === 'unlock_required')
        return SE_CARD_WORDS.unlockLine;
    if (reason === 'unlock_paused')
        return SE_CARD_WORDS.pausedLine;
    return null;
}
