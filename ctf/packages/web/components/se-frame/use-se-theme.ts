'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_DEFAULT_THEME, SE_THEME_STORE_KEY, seParseThemeChoice, type SeThemeChoice } from '@ctf/shared';

// The member's 3.1 colors, kept in this browser. Storage can be refused (a private window); the
// frame then shows the default and the choice lasts until the page closes.
export function useSeTheme(): { theme: SeThemeChoice; setTheme: (_next: SeThemeChoice) => void } {
  const [theme, setThemeState] = useState<SeThemeChoice>({ ...SE_DEFAULT_THEME });

  useEffect(() => {
    try {
      setThemeState(seParseThemeChoice(window.localStorage.getItem(SE_THEME_STORE_KEY)));
    } catch {
      // no-trace: storage refused; the default stays.
    }
  }, []);

  const setTheme = useCallback((next: SeThemeChoice) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(SE_THEME_STORE_KEY, JSON.stringify(next));
    } catch {
      // no-trace: storage refused; the choice lasts for this page only.
    }
  }, []);

  return { theme, setTheme };
}
