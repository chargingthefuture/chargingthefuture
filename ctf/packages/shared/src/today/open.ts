// Me → Open (owner request, 2026-11-23): every card on the member's Today that they are part of and
// that is not done or closed. Their own asks, offers and posts, their own goal while it is not
// reached, and the cards they answered, wrote in, or asked or agreed to talk just you two on
// (`joined`, set by the server from the card conversation store). Read from the same /api/today
// answer Today draws, so the list and Today always agree; a card leaves Open when it leaves Today or
// is marked done. Shared by web and Android.

import { seGoalTakenLine } from './goal-share';
import { seOnTodayUntil } from './lifetime';
import type { SeTodayCard } from './types';

export type SeOpenState = 'yours' | 'goal' | 'joined';

export type SeOpenItem = { card: SeTodayCard; state: SeOpenState; line: string };

export const SE_OPEN_WORDS = {
  title: 'Open',
  intro: 'Cards you are part of that are not done yet: your asks, offers and goals, and the cards you answered or wrote in.',
  empty: 'Nothing open. When you post an ask, an offer or a goal, or answer a card on Today, it is listed here until it is done.',
  failed: 'Could not read your open cards.',
  loading: 'Loading…',
  yours: 'Yours',
  goal: 'Your goal',
  joined: 'You answered or wrote here',
};

// A card marked done with its dot is already off Today. `done` is the server's own (a 21 Questions
// answer); a goal is done once reached. A card only read today (markedDoneAtIso) is still open.
function isDone(card: SeTodayCard): boolean {
  return card.done === true || card.goal?.reached === true;
}

function stateOf(card: SeTodayCard, viewerId: string): SeOpenState | null {
  if (card.goal) return 'goal';
  if (card.mine || card.author?.accountId === viewerId) return 'yours';
  return card.joined ? 'joined' : null;
}

function lineFor(card: SeTodayCard, state: SeOpenState): string {
  if (state === 'goal' && card.goal) return `${SE_OPEN_WORDS.goal} · ${seGoalTakenLine(card.goal)}`;
  if (state === 'yours') return card.mine ? `${SE_OPEN_WORDS.yours} · ${seOnTodayUntil(card.mine.leavesIso)}` : SE_OPEN_WORDS.yours;
  return SE_OPEN_WORDS.joined;
}

// In Today's own order (newest first). A card counted twice by its sources is listed once.
export function seOpenCards(cards: readonly SeTodayCard[], viewerId: string): SeOpenItem[] {
  const seen = new Set<string>();
  const items: SeOpenItem[] = [];
  for (const card of cards) {
    const state = isDone(card) || seen.has(card.id) ? null : stateOf(card, viewerId);
    if (!state) continue;
    seen.add(card.id);
    items.push({ card, state, line: lineFor(card, state) });
  }
  return items;
}
