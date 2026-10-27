// The member's 3.1 colors, kept on the phone, the Android copy of the web's use-se-theme.ts. A file
// that cannot be read or written leaves the default in place.

import { useCallback, useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { SE_DEFAULT_THEME, SE_THEME_STORE_KEY, seParseThemeChoice, type SeThemeChoice } from '@ctf/shared';
import { reportError } from '../../observability/report';

function store(): File {
  return new File(Paths.document, `${SE_THEME_STORE_KEY}.json`);
}

export function useSeTheme(): { theme: SeThemeChoice; setTheme: (_next: SeThemeChoice) => void } {
  const [theme, setThemeState] = useState<SeThemeChoice>({ ...SE_DEFAULT_THEME });

  useEffect(() => {
    let active = true;
    const file = store();
    if (!file.exists) return;
    file
      .text()
      .then((raw) => {
        if (active) setThemeState(seParseThemeChoice(raw));
      })
      .catch(() => {
        // no-trace: the saved choice is unreadable; the default stays.
      });
    return () => {
      active = false;
    };
  }, []);

  const setTheme = useCallback((next: SeThemeChoice) => {
    setThemeState(next);
    try {
      const file = store();
      if (!file.exists) file.create();
      file.write(JSON.stringify(next));
    } catch (error) {
      reportError(error, { area: 'se-frame', op: 'save_theme' });
    }
  }, []);

  return { theme, setTheme };
}
