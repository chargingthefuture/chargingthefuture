// The Today read: one answer that carries everything the Today screen draws, so the screen makes a
// single request and can keep the last answer on the phone to draw at once on the next open.
// Built on the server by ctf/packages/web/lib/today/; drawn by web components/se-frame/today/ and
// Android src/features/se-frame/today/.

import type { SeCardKind } from '../design/se-theme';

// What a quick response does. Each opens the item where it lives; a response that writes
// something (an offer of help, "This helped me") is made there, by the feature that owns it.
export type SeTodayActionKind = 'open' | 'help' | 'know-someone' | 'want' | 'helped-me' | 'join' | 'listen' | 'check-in';

export type SeTodayAction = { kind: SeTodayActionKind; label: string; href: string };

export type SeTodayAuthor = { accountId: string; handle: string };

export type SeTodayCard = {
  // `${source}:${sourceId}`, stable across reads so a card keeps its read and hidden state.
  id: string;
  kind: SeCardKind;
  source: string;
  // The small colored line above the title, e.g. "Ask", "Offer · a place to stay".
  label: string;
  title: string;
  body: string | null;
  author: SeTodayAuthor | null;
  createdAtIso: string;
  // Where the full feature opens.
  href: string;
  actions: SeTodayAction[];
};

export type SeTodayRoom = {
  key: 'main' | 'weavers';
  name: string;
  live: boolean;
  // Signed-in members in the room, and signed-out guests listening.
  members: number;
  guests: number;
  href: string;
};

export type SeTodayBroadcast = { live: boolean; title: string | null; href: string };

export type SeToday = {
  generatedAtIso: string;
  presence: number | null;
  broadcast: SeTodayBroadcast | null;
  rooms: SeTodayRoom[];
  cards: SeTodayCard[];
  // Sources that failed to read this time, named so the screen can say so rather than look empty.
  unavailable: string[];
};
