// What the 3.1 room screen hands the Chyme parts it draws, the Android copy of the web
// (web components/chyme/chyme-embed.tsx): the More sheet's open state, the room's refresh and join,
// a way to tell the screen (and the room bar) what the call is doing, and the member's 3.1 colors.
// 3.0's Chyme screen provides none of it, and every part keeps its 3.0 layout without it.

import { createContext, useContext, type MutableRefObject } from 'react';
import type { SeThemeTokens } from '@ctf/shared';

// What the call says, for the header's "Since" and the room bar. `speakers` are the other people
// whose microphone is on, by name.
export type ChymeLiveSummary = {
  startedAtIso: string | null;
  speakers: Array<{ id: string; name: string }>;
  selfSpeaking: boolean;
  handRaised: boolean;
  canRaiseHand: boolean;
};

export type ChymeEmbed = {
  t: SeThemeTokens;
  moreOpen: boolean;
  setMoreOpen: (_open: boolean) => void;
  refresh: () => void;
  refreshing: boolean;
  join: () => void;
  joining: boolean;
  reportLive: (_summary: ChymeLiveSummary | null) => void;
  // Set by the call while it runs, so the room bar can raise and lower the member's hand.
  handToggle: MutableRefObject<(() => void) | null>;
};

export const ChymeEmbedContext = createContext<ChymeEmbed | null>(null);

export function useChymeEmbed(): ChymeEmbed | null {
  return useContext(ChymeEmbedContext);
}
