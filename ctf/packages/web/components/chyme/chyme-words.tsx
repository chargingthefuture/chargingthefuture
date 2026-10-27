'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SeRoomWords } from '@ctf/shared';

// The labels on Chyme's join, leave and Back Channel buttons. 3.0's Chyme page uses the defaults;
// the 3.1 room wraps the same components in a provider with the 3.1 words.

const CHYME_WORDS_DEFAULT: SeRoomWords = { join: 'Join Room', leave: 'Leave', backChannel: 'Back Channel', guestNotice: null };

const ChymeWordsContext = createContext<SeRoomWords>(CHYME_WORDS_DEFAULT);

export function ChymeWordsProvider({ words, children }: { words: SeRoomWords; children: ReactNode }) {
  return <ChymeWordsContext.Provider value={words}>{children}</ChymeWordsContext.Provider>;
}

export function useChymeWords(): SeRoomWords {
  return useContext(ChymeWordsContext);
}
