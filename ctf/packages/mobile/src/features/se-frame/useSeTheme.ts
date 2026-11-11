// The member's 3.1 colors for a screen drawn outside the frame (a game, a card's conversation),
// read from the phone's copy of the choice saved on the account; the Android copy of the web's
// use-se-theme.ts. The frame (useSePrefs.ts) reads the account and keeps that copy current. A file
// that cannot be read leaves the default in place.

import { useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { SE_DEFAULT_THEME, SE_THEME_STORE_KEY, seParseThemeChoice, type SeThemeChoice } from '@ctf/shared';

export function themeCacheFile(): File {
  return new File(Paths.document, `${SE_THEME_STORE_KEY}.json`);
}

export function useSeTheme(): { theme: SeThemeChoice } {
  const [theme, setTheme] = useState<SeThemeChoice>({ ...SE_DEFAULT_THEME });
  useEffect(() => {
    let active = true;
    const file = themeCacheFile();
    if (!file.exists) return;
    file
      .text()
      .then((raw) => {
        if (active) setTheme(seParseThemeChoice(raw));
      })
      .catch(() => {
        // no-trace: the saved copy is unreadable; the default stays.
      });
    return () => {
      active = false;
    };
  }, []);
  return { theme };
}
