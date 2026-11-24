'use client';

import { useEffect, useState } from 'react';
import { SE_DEFAULT_THEME, SE_THEME_STORE_KEY, seParseThemeChoice, type SeThemeChoice } from '@ctf/shared';

// The member's 3.1 colors for a screen drawn outside the frame (a game, a room, a card's
// conversation), read from this browser's copy of the choice saved on the account. The frame
// (use-se-prefs.ts) reads the account and keeps that copy current. Storage can be refused (a private
// window); the default colors are then used. `picked` says whether this browser holds a choice at all,
// so a signed-out screen can keep its own light default for a visitor who never picked one.
export function useSeTheme(): { theme: SeThemeChoice; picked: boolean } {
  const [theme, setTheme] = useState<SeThemeChoice>({ ...SE_DEFAULT_THEME });
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SE_THEME_STORE_KEY);
      setTheme(seParseThemeChoice(stored));
      setPicked(stored !== null);
    } catch {
      // no-trace: storage refused; the default stays.
    }
  }, []);
  return { theme, picked };
}
