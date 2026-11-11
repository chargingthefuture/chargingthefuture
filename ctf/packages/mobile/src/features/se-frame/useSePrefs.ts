// The member's 3.1 look on Android, the copy of the web's use-se-prefs.ts: colors, text size, higher
// contrast, easier-to-read font and emoji rain, saved on the account (/api/account/ui-preferences).
// The phone keeps a copy of the colors only so the first frame is drawn in them; the account's
// answer wins. A save that fails puts the earlier choice back and says why.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SE_DEFAULT_READING,
  SE_DEFAULT_THEME,
  SE_SETTINGS_WORDS,
  seParseThemeChoice,
  type SeReadingPrefs,
  type SeThemeChoice,
} from '@ctf/shared';
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';
import { reportError } from '../../observability/report';
import { themeCacheFile } from './useSeTheme';

const PATH = '/api/account/ui-preferences';

type Saved = { seTheme?: SeThemeChoice | null; reading?: SeReadingPrefs };

function cacheTheme(theme: SeThemeChoice) {
  try {
    const file = themeCacheFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(theme));
  } catch (error) {
    reportError(error, { area: 'se-frame', op: 'cache_theme' });
  }
}

async function failureMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return `${SE_SETTINGS_WORDS.saveFailed} ${body?.message ?? `(HTTP ${res.status})`}`;
}

export type SePrefs = {
  theme: SeThemeChoice;
  reading: SeReadingPrefs;
  error: string | null;
  setTheme: (_next: SeThemeChoice) => void;
  setReading: (_change: Partial<SeReadingPrefs>) => void;
};

function useInitialLoad(setTheme: (_t: SeThemeChoice) => void, setReading: (_r: SeReadingPrefs) => void) {
  useEffect(() => {
    let active = true;
    const file = themeCacheFile();
    if (file.exists) {
      file
        .text()
        .then((raw) => active && setTheme(seParseThemeChoice(raw)))
        .catch(() => undefined);
    }
    authedFetchJson<Saved>(PATH)
      .then((saved) => {
        if (!active) return;
        if (saved.seTheme) {
          setTheme(saved.seTheme);
          cacheTheme(saved.seTheme);
        }
        if (saved.reading) setReading(saved.reading);
      })
      .catch((error: unknown) => reportError(error, { area: 'se-frame', op: 'read_look' }));
    return () => {
      active = false;
    };
  }, [setTheme, setReading]);
}

export function useSePrefs(): SePrefs {
  const [theme, setThemeState] = useState<SeThemeChoice>({ ...SE_DEFAULT_THEME });
  const [reading, setReadingState] = useState<SeReadingPrefs>({ ...SE_DEFAULT_READING });
  const [error, setError] = useState<string | null>(null);
  const current = useRef({ theme, reading });
  current.current = { theme, reading };
  useInitialLoad(setThemeState, setReadingState);

  const save = useCallback(async (body: Record<string, unknown>, undo: () => void) => {
    setError(null);
    try {
      const res = await authedFetch(PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      undo();
      setError(await failureMessage(res));
    } catch (caught) {
      reportError(caught, { area: 'se-frame', op: 'save_look' });
      undo();
      setError(SE_SETTINGS_WORDS.saveFailed);
    }
  }, []);

  const setTheme = useCallback(
    (next: SeThemeChoice) => {
      const before = current.current.theme;
      setThemeState(next);
      cacheTheme(next);
      void save({ seTheme: next }, () => {
        setThemeState(before);
        cacheTheme(before);
      });
    },
    [save],
  );

  const setReading = useCallback(
    (change: Partial<SeReadingPrefs>) => {
      const before = current.current.reading;
      setReadingState({ ...before, ...change });
      void save(change, () => setReadingState(before));
    },
    [save],
  );

  return { theme, reading, error, setTheme, setReading };
}
