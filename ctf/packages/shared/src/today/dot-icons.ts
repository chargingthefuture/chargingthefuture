// The icon inside each Today card's timeline dot, by card kind, as on the approved Today board: an
// arrow up on an ask, an arrow down on an offer, a book on a story, a magnifier on a match (Wanted),
// a face on Mood. The board has no card of the other kinds, so they take the plainest sign of what
// they are: bars for the numbers, a play mark for a replay, a grid for a game. Drawn in the dot's
// own text color (onKind) on a 24-unit square at 14 points, the same on web and Android.

import type { SeCardKind } from '../design/se-theme';

export type SeCardDotIcon = { paths: readonly string[]; strokeWidth: number };

export const SE_CARD_DOT_ICONS: Record<SeCardKind, SeCardDotIcon> = {
  ask: { paths: ['M12 19V5M5 12l7-7 7 7'], strokeWidth: 2.4 },
  offer: { paths: ['M12 5v14M5 12l7 7 7-7'], strokeWidth: 2.4 },
  story: { paths: ['M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-5a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h5z'], strokeWidth: 2.2 },
  match: { paths: ['M5 11a6 6 0 1 0 12 0a6 6 0 1 0-12 0', 'M20 20l-4.5-4.5'], strokeWidth: 2.4 },
  mood: { paths: ['M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M9 14c1.5 1.5 4.5 1.5 6 0'], strokeWidth: 2.4 },
  numbers: { paths: ['M6 20v-7M12 20V5M18 20v-10'], strokeWidth: 2.4 },
  replay: { paths: ['M8 5v14l11-7z'], strokeWidth: 2.2 },
  game: { paths: ['M5 5h14v14H5zM5 12h14M12 5v14'], strokeWidth: 2.2 },
};

// The check mark a card's dot shows once the card is done, in place of its icon.
export const SE_CARD_DOT_CHECK = 'M5 12l5 5 9-10';

export function seCardDotIcon(kind: SeCardKind): SeCardDotIcon {
  return SE_CARD_DOT_ICONS[kind] ?? SE_CARD_DOT_ICONS.story;
}
