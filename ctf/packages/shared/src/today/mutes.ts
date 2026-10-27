// Personal mute in 3.1, shared by web and Android: what a mute is, and which Today cards it leaves
// out. Nobody is told; a mute is not a block.

import type { SeTodayCard } from './types';

export type SeMute = { id: string; kind: 'person' | 'words'; target: string; label: string | null; createdAtIso: string };

export const SE_MUTE_WORDS = {
  title: 'Muted',
  intro: 'Cards by a muted person, or with muted words in them, leave Today. Nobody is told.',
  addWords: 'Mute words',
  addPlaceholder: 'A word or phrase',
  add: 'Mute',
  remove: 'Unmute',
  empty: 'Nothing muted.',
  mutePerson: (handle: string) => `Mute ${handle}`,
  muted: (handle: string) => `${handle} is muted. Their cards leave Today.`,
  failed: 'Could not change your mutes.',
};

export function seNormalizeMuteWords(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function seApplyMutes(cards: readonly SeTodayCard[], mutes: readonly Pick<SeMute, 'kind' | 'target'>[]): SeTodayCard[] {
  const people = new Set(mutes.filter((mute) => mute.kind === 'person').map((mute) => mute.target));
  const words = mutes.filter((mute) => mute.kind === 'words').map((mute) => mute.target).filter(Boolean);
  return cards.filter((card) => {
    if (card.author && people.has(card.author.accountId)) return false;
    const text = `${card.title} ${card.body ?? ''}`.toLowerCase();
    return !words.some((word) => text.includes(word));
  });
}
