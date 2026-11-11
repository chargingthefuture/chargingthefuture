'use client';

import { useEffect, useState } from 'react';
import { SE_DEFAULT_THEME, SE_THEME_STORE_KEY, seParseThemeChoice, type SeThemeChoice } from '@ctf/shared';

// The member's 3.1 colors for a screen drawn outside the frame (a game, a room, a card's
// conversation), read from this browser's copy of the choice saved on the account. The frame
// (use-se-prefs.ts) reads the account and keeps that copy current. Storage can be refused (a private
// window); the default colors are then used.
export function useSeTheme(): { theme: SeThemeChoice } {
  const [theme, setTheme] = useState<SeThemeChoice>({ ...SE_DEFAULT_THEME });
  useEffect(() => {
    try {
      setTheme(seParseThemeChoice(window.localStorage.getItem(SE_THEME_STORE_KEY)));
    } catch {
      // no-trace: storage refused; the default stays.
    }
  }, []);
  return { theme };
}
