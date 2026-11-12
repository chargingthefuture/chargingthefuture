'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SE_DEFAULT_READING,
  SE_DEFAULT_THEME,
  SE_SETTINGS_WORDS,
  SE_THEME_STORE_KEY,
  seParseThemeChoice,
  type SeReadingPrefs,
  type SeThemeChoice,
} from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { reportError } from 'lib/observability/report';

// The member's 3.1 look: colors, text size, higher contrast, easier-to-read font and emoji rain,
// saved on the account (/api/account/ui-preferences). The browser keeps a copy of the colors only so
// the first frame is drawn in them before the account answers; the account's answer wins. A save
// that fails puts the earlier choice back and says why. It also carries the Days won total Today last
// saw for this account, which decides when emoji rain falls (emoji-rain.tsx).

const URL = '/api/account/ui-preferences';

type Saved = { seTheme?: SeThemeChoice | null; reading?: SeReadingPrefs; daysWonSeen?: number | null };

function cacheTheme(theme: SeThemeChoice) {
  try {
    window.localStorage.setItem(SE_THEME_STORE_KEY, JSON.stringify(theme));
  } catch {
    // no-trace: storage refused; the account still holds the choice.
  }
}

export type SePrefs = {
  theme: SeThemeChoice;
  reading: SeReadingPrefs;
  error: string | null;
  setTheme: (_next: SeThemeChoice) => void;
  setReading: (_change: Partial<SeReadingPrefs>) => void;
  // undefined until the account answers; null when Today has never recorded a total.
  daysWonSeen: number | null | undefined;
  markDaysWonSeen: (_total: number) => void;
};

export function useSePrefs(): SePrefs {
  const [theme, setThemeState] = useState<SeThemeChoice>({ ...SE_DEFAULT_THEME });
  const [reading, setReadingState] = useState<SeReadingPrefs>({ ...SE_DEFAULT_READING });
  const [error, setError] = useState<string | null>(null);
  const [daysWonSeen, setDaysWonSeen] = useState<number | null | undefined>(undefined);
  const current = useRef({ theme, reading });
  current.current = { theme, reading };

  useEffect(() => {
    try {
      setThemeState(seParseThemeChoice(window.localStorage.getItem(SE_THEME_STORE_KEY)));
    } catch {
      // no-trace: storage refused; the account's answer below sets the colors.
    }
    void fetch(URL, { cache: 'no-store' })
      .then(async (res) => (res.ok ? ((await res.json()) as Saved) : null))
      .then((saved) => {
        if (saved?.seTheme) {
          setThemeState(saved.seTheme);
          cacheTheme(saved.seTheme);
        }
        if (saved?.reading) setReadingState(saved.reading);
        if (saved) setDaysWonSeen(typeof saved.daysWonSeen === 'number' ? saved.daysWonSeen : null);
      })
      .catch(() => {
        // no-trace: the saved look could not be read; the device copy and defaults stay.
      });
  }, []);

  const save = useCallback(async (body: Record<string, unknown>, undo: () => void) => {
    setError(null);
    try {
      const res = await fetch(URL, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      undo();
      setError(await responseFailureText(res, SE_SETTINGS_WORDS.saveFailed, 'member'));
    } catch (caught) {
      undo();
      setError(failureText(caught, { area: 'se-frame', op: 'save_look', fallback: SE_SETTINGS_WORDS.saveFailed, audience: 'member' }));
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

  // Not a choice the member makes, so a failed save is reported rather than shown; the next Today
  // read records it again.
  const markDaysWonSeen = useCallback((total: number) => {
    setDaysWonSeen(total);
    void fetch(URL, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ daysWonSeen: total }),
    })
      .then((res) => {
        if (!res.ok) reportError(new Error(`Saving the Days won total Today showed failed (HTTP ${res.status})`), { area: 'se-frame', op: 'save_days_won_seen' });
      })
      .catch((caught: unknown) => reportError(caught, { area: 'se-frame', op: 'save_days_won_seen' }));
  }, []);

  return { theme, reading, error, setTheme, setReading, daysWonSeen, markDaysWonSeen };
}
