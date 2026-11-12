// Card conversations in 3.1, shared by web and Android: a Today card of kind ask, offer or story
// opens in place as a sheet with the people who answered it, a public conversation, and "Just us
// two", a private conversation between two members on that card that opens once both agree.
// The conversation belongs to the plugin behind the card (owner decision, 2026-11-10): Commons holds
// one store whose rows name the plugin and the item (`seCardItemRef`), so a ride's conversation is
// TrustTransport's, a place's is LightHouse's, and Commons' when no other plugin is behind the card.
// Built on the server by ctf/packages/web/lib/today/cards/; drawn by web
// components/se-frame/today/card-sheet*.tsx and Android src/features/se-frame/today/CardSheet*.tsx.

import type { SeCardKind } from '../design/se-theme';
import type { SeTodayActionKind, SeTodayCard } from './types';

// The answers a member can give on a card: the quick responses that say something about the
// member, not the ones that only open a page.
export type SeCardAnswerKind = 'help' | 'know-someone' | 'want' | 'helped-me';

export const SE_CARD_ANSWER_KINDS: readonly SeCardAnswerKind[] = ['help', 'know-someone', 'want', 'helped-me'];

export const SE_CARD_MESSAGE_MAX = 1000;
export const SE_CARD_ID_MAX = 200;

// `${source}:${sourceId}`: a lower-case source name, a colon, then the source's own id with no
// spaces (some are addresses, so they carry colons and slashes of their own).
const CARD_ID = /^[a-z][a-z0-9-]{0,39}:\S{1,200}$/;

// 21 Questions keeps its own controls inside the card and never opens a sheet.
const OWN_CONTROLS = new Set(['questions', 'questions-match']);

// Cards that expand in place rather than open a sheet: the "with you this week" cohort card, whose
// talk is the cohort's own room on the goal board.
const IN_PLACE_SOURCES = new Set(['peer-programming-cohort']);

// A card's id from its source and the source's own id: what Today builds for the card, and what a
// plugin's own page builds to show the same conversation.
export function seCardId(source: string, sourceId: string): string {
  return `${source}:${sourceId}`;
}

export function seCardIdValid(id: string): boolean {
  if (id.length > SE_CARD_ID_MAX || !CARD_ID.test(id)) return false;
  return !OWN_CONTROLS.has(id.slice(0, id.indexOf(':')));
}

const SHEET_KINDS: ReadonlySet<SeCardKind> = new Set<SeCardKind>(['ask', 'offer', 'story']);

// The plugin a card's conversation belongs to, by the card's source. A source not listed goes to
// Commons: an announcement or the Quora survey, which have no plugin of their own, and SkillsHunt,
// What Works and Directory invitations, whose talk is for the group rather than one item's
// (owner decision, 2026-11-10).
const CARD_SOURCE_PLUGIN: Readonly<Record<string, string>> = {
  'trust-transport': 'trust-transport',
  lighthouse: 'lighthouse',
  'socket-relay': 'socket-relay',
  'peer-programming': 'peer-programming',
  'skill-up': 'skill-up',
  'blog-story': 'fireside',
};

export type SeCardItemRef = { plugin: string; itemId: string };

// Which plugin item a card is: the plugin from the card's source, and the source's own id. In
// Commons the item id keeps the source in front (`what-works:12`), so items from different sources
// never share a conversation.
export function seCardItemRef(cardId: string): SeCardItemRef {
  const colon = cardId.indexOf(':');
  const plugin = CARD_SOURCE_PLUGIN[cardId.slice(0, colon)];
  return plugin ? { plugin, itemId: cardId.slice(colon + 1) } : { plugin: 'commons', itemId: cardId };
}

// Whether tapping the card's text opens the sheet; every other card keeps expanding in place.
export function seCardOpensSheet(card: Pick<SeTodayCard, 'kind' | 'source'>): boolean {
  return SHEET_KINDS.has(card.kind) && !OWN_CONTROLS.has(card.source) && !IN_PLACE_SOURCES.has(card.source);
}

// The note under the composer on a blog story's public conversation; null on every other card and
// in Just us two, which never reaches the blog.
export function seCardBlogNote(cardId: string, publicThread: boolean): string | null {
  return publicThread && cardId.startsWith('blog-story:') ? SE_CARD_WORDS.blogNote : null;
}

export function seCardAnswerKind(kind: SeTodayActionKind): SeCardAnswerKind | null {
  return (SE_CARD_ANSWER_KINDS as readonly string[]).includes(kind) ? (kind as SeCardAnswerKind) : null;
}

// The two account ids of a Just us two conversation, lower first, so one pair has one key.
export function seCardPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// `helpedConfirmed`: the card's author confirmed this member's "This helped me" (3.1.0 plan,
// Measures: it counts 10 action minutes toward Days won).
export type SeCardAnswer = { accountId: string; handle: string; kinds: SeCardAnswerKind[]; helpedConfirmed: boolean };

export type SeCardMessage = {
  id: string;
  authorId: string;
  handle: string;
  mine: boolean;
  body: string;
  createdAtIso: string;
  // When the author last changed it; null when never changed.
  editedAtIso: string | null;
};

// A Just us two conversation as the viewer sees it: they asked and wait, the other person asked
// them, or both agreed and it is open.
export type SeCardPairState = 'waiting' | 'asked-me' | 'open';

export type SeCardPairThread = {
  partnerId: string;
  partnerHandle: string;
  state: SeCardPairState;
  messages: SeCardMessage[];
};

export type SeCardConversation = {
  cardId: string;
  // The viewer, so the sheet can say You on their own answer and offer Talk here only beside others.
  viewerId: string;
  answers: SeCardAnswer[];
  // The viewer wrote the card (the System Architect, for a blog story, an announcement or What
  // Works), so the sheet offers Confirm beside each "This helped me" not yet confirmed.
  canConfirmHelped: boolean;
  mine: SeCardAnswerKind[];
  messages: SeCardMessage[];
  pairs: SeCardPairThread[];
};

const ANSWER_WORDS: Record<SeCardAnswerKind, string> = {
  help: 'can help',
  'know-someone': 'knows someone',
  want: 'would like this',
  'helped-me': 'says this helped',
};

const KIND_WORDS: Partial<Record<SeCardKind, string>> = { ask: 'Ask', offer: 'Offer', story: 'Story' };

// A source whose link opens something narrower than the place it lives says what it opens, so the
// link in the sheet matches the card's own button: an invite card's Read it opens the invitation.
const OPEN_WORDS: Record<string, string> = { 'directory-invite': 'Read the invitation' };

// Where each source's item lives, for the "Open in …" link in the sheet.
const SOURCE_NAMES: Record<string, string> = {
  'peer-programming': 'PeerProgramming',
  'socket-relay': 'SocketRelay',
  'trust-transport': 'TrustTransport',
  'skills-hunt': 'SkillsHunt',
  'skills-hunt-mission': 'SkillsHunt',
  lighthouse: 'LightHouse',
  'mutual-time': 'Mutual Time',
  'skill-up': 'SkillUp',
  'what-works': 'WhatWorks',
  'blog-story': 'the blog',
  'quora-survey': 'the survey',
};

export const SE_CARD_WORDS = {
  answered: (count: number) => (count === 1 ? '1 person answered' : `${count} people answered`),
  answerLine: (kinds: readonly SeCardAnswerKind[]) => kinds.map((kind) => ANSWER_WORDS[kind]).join(', '),
  talkHere: 'Talk here',
  conversation: 'Conversation',
  hideConversation: 'Hide the conversation',
  whoReads: 'Who can read it',
  public: 'Public',
  pair: 'Just us two',
  composer: 'Write in this card',
  send: 'Send',
  publicHint: 'Everyone can read this. Just us two opens once you both agree.',
  // Under the public composer of a story card from the blog only (plan, Card rules): what a member
  // writes there is the post's Fireside conversation.
  blogNote: 'Your comment can also appear under this post on the blog.',
  pairHint: (handle: string) => `Only you and ${handle} can read this.`,
  pairNone: 'Nobody is talking just you two yet. Tap Talk here next to somebody, or Just us two under a message.',
  waiting: (handle: string) => `Waiting for ${handle} to agree`,
  askedMe: (handle: string) => `${handle} asked to talk just you two`,
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
  openIn: (source: string) => OPEN_WORDS[source] ?? (SOURCE_NAMES[source] ? `Open in ${SOURCE_NAMES[source]}` : 'Open where it lives'),
  you: 'You',
  confirmHelped: 'Confirm',
  confirmHelpedLabel: (handle: string) => `Confirm that this helped ${handle}`,
  helpedConfirmed: 'Confirmed',
};

// Whether the sheet offers Confirm beside an answer: the viewer wrote the card, the answer says
// this helped, and it is not confirmed yet. Never on the viewer's own answer.
export function seCanConfirmHelped(conversation: Pick<SeCardConversation, 'canConfirmHelped' | 'viewerId'>, answer: SeCardAnswer): boolean {
  return conversation.canConfirmHelped && answer.accountId !== conversation.viewerId && answer.kinds.includes('helped-me') && !answer.helpedConfirmed;
}

// Cards the System Architect writes or reviews: a blog story, an announcement, What Works (whose
// suggesters are never named). On these an admin confirms a "This helped me"; on any other card,
// the member who posted the item.
const SYSTEM_ARCHITECT_SOURCES: ReadonlySet<string> = new Set(['blog-story', 'announcement', 'what-works']);

export function seHelpedConfirmedByAdmin(cardId: string): boolean {
  return SYSTEM_ARCHITECT_SOURCES.has(cardId.slice(0, cardId.indexOf(':')));
}

// "Ask · October 26, 2026 at 11:40 AM CDT", the line under the author in the sheet.
export function seCardSheetLine(card: Pick<SeTodayCard, 'kind' | 'label' | 'createdAtIso'>): string {
  const at = new Date(card.createdAtIso);
  const day = at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const kind = KIND_WORDS[card.kind] ?? card.label.split(' · ')[0];
  return `${kind} · ${day} at ${time}`;
}

// The line a card shows when a write is refused for Unlock: not approved yet (cards closed before
// Unlock), or paused after day 14. Null for any other refusal.
export function seCardLockLine(reason: unknown): string | null {
  if (reason === 'unlock_required') return SE_CARD_WORDS.unlockLine;
  if (reason === 'unlock_paused') return SE_CARD_WORDS.pausedLine;
  return null;
}
