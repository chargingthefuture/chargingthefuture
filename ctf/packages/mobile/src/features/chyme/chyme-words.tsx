// The labels on Chyme's join, leave and Back Channel buttons, the Android copy of the web
// (web components/chyme/chyme-words.tsx). 3.0's Chyme screen uses the defaults; the 3.1 room wraps
// the same components in a provider with the 3.1 words.

import React, { createContext, useContext, type ReactNode } from 'react';
import type { SeRoomWords } from '@ctf/shared';

const CHYME_WORDS_DEFAULT: SeRoomWords = { join: 'Join Room', leave: 'Leave', backChannel: 'Back Channel', guestNotice: null };

const ChymeWordsContext = createContext<SeRoomWords>(CHYME_WORDS_DEFAULT);

export function ChymeWordsProvider({ words, children }: { words: SeRoomWords; children: ReactNode }) {
  return <ChymeWordsContext.Provider value={words}>{children}</ChymeWordsContext.Provider>;
}

export function useChymeWords(): SeRoomWords {
  return useContext(ChymeWordsContext);
}
