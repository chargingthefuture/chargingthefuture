// Personal mute in 3.1, shared by web and Android: what a mute is, and which Today cards it leaves
// out. Nobody is told; a mute is not a block. A muted post (target: the Today card id) also sends
// the member no Activity notices from that card's conversation.

import type { SeTodayCard } from './types';

export type SeMuteKind = 'person' | 'post' | 'words';

export const SE_MUTE_KINDS: readonly SeMuteKind[] = ['person', 'post', 'words'];

export type SeMute = { id: string; kind: SeMuteKind; target: string; label: string | null; createdAtIso: string };

export const SE_MUTE_WORDS = {
  title: 'Muted',
  intro: 'Cards by a muted person, muted posts, and cards with muted words in them leave Today. A muted post sends you no notices. Nobody is told.',
  addWords: 'Mute words',
  addPlaceholder: 'A word or phrase',
  add: 'Mute',
  remove: 'Unmute',
  empty: 'Nothing muted.',
  mutePerson: (handle: string) => `Mute ${handle}`,
  muted: (handle: string) => `${handle} is muted. Their cards leave Today.`,
  mutePost: 'Mute this post',
  mutedPost: 'Post muted. It leaves Today, and its conversation sends you no notices.',
  failed: 'Could not change your mutes.',
};

// How one mute reads in the Muted list: the handle, the post's title, or the words in quotes.
export function seMuteRowLabel(mute: Pick<SeMute, 'kind' | 'target' | 'label'>): string {
  if (mute.kind === 'person') return mute.label ?? 'A member';
  if (mute.kind === 'post') return `Post: ${mute.label ?? 'a card in Today'}`;
  return `“${mute.target}”`;
}

// A post mute's target is a Today card id: a lower-case source name, a colon, then the source's id.
export function seMutePostTargetValid(cardId: string): boolean {
  return cardId.length <= 200 && /^[a-z][a-z0-9-]{0,39}:\S{1,200}$/.test(cardId);
}

// What muting from a card sends to POST /api/account/mutes: its author by account id and handle, or
// the card itself by id and title. Null for a person mute on a card with no author.
export type SeCardMuteKind = 'person' | 'post';

export function seCardMuteRequest(card: SeTodayCard, kind: SeCardMuteKind): { kind: SeCardMuteKind; target: string; label: string } | null {
  if (kind === 'post') return { kind, target: card.id, label: card.title.slice(0, 80) };
  return card.author ? { kind, target: card.author.accountId, label: card.author.handle } : null;
}

// The line Today shows once a mute from a card is saved.
export function seCardMutedNote(card: SeTodayCard, kind: SeCardMuteKind): string {
  return kind === 'person' && card.author ? SE_MUTE_WORDS.muted(card.author.handle) : SE_MUTE_WORDS.mutedPost;
}

export function seNormalizeMuteWords(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function targetsOf(mutes: readonly Pick<SeMute, 'kind' | 'target'>[], kind: SeMuteKind): string[] {
  return mutes.filter((mute) => mute.kind === kind).map((mute) => mute.target).filter(Boolean);
}

export function seApplyMutes(cards: readonly SeTodayCard[], mutes: readonly Pick<SeMute, 'kind' | 'target'>[]): SeTodayCard[] {
  const people = new Set(targetsOf(mutes, 'person'));
  const posts = new Set(targetsOf(mutes, 'post'));
  const words = targetsOf(mutes, 'words');
  return cards.filter((card) => {
    if (posts.has(card.id)) return false;
    if (card.author && people.has(card.author.accountId)) return false;
    const text = `${card.title} ${card.body ?? ''}`.toLowerCase();
    return !words.some((word) => text.includes(word));
  });
}
