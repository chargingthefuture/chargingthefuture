import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { authedFetch } from '../auth/authedFetch';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  getThemeTokens,
  normalizeTheme,
  type ThemeName,
  type ThemeTokens,
} from './theme-tokens';

// Mobile theme provider — mirrors the web's hooks/useTheme.tsx shape.
//
// The choice persists two ways, matching the web:
//   1. On-device, so a returning user keeps their theme offline. The web uses
//      localStorage under the "sh-theme" key; the device equivalent here is
//      expo-secure-store under the same key.
//   2. Server-side, via PUT /api/account/ui-preferences, so the choice follows the
//      signed-in account across devices and stays in sync with the web. On load we
//      read GET /api/account/ui-preferences (the server is the source of truth for a
//      signed-in account); failures / signed-out simply keep the local choice.
//
// SecureStore keys must be alphanumeric / '.' / '-' / '_', so the literal "sh-theme"
// from the spec is a valid key as-is.

type ThemeContextValue = {
  theme: ThemeName;
  tokens: ThemeTokens;
  setTheme: (_theme: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const PREFERENCES_PATH = '/api/account/ui-preferences';

async function readStoredTheme(): Promise<ThemeName> {
  try {
    const raw = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
    return normalizeTheme(raw);
  } catch {
    return DEFAULT_THEME;
  }
}

async function writeStoredTheme(theme: ThemeName): Promise<void> {
  try {
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, theme);
  } catch {
    // no-trace: storage is unavailable, and the in-memory choice still applies this session.
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);
  const didInit = useRef(false);

  const applyTheme = useCallback((next: ThemeName, persistToServer: boolean) => {
    setThemeState(next);
    void writeStoredTheme(next);
    if (persistToServer) {
      // Best-effort sync to the signed-in user's profile so the choice follows the
      // account across devices and matches the web. The account routes require the
      // same-origin CSRF confirmation header. Signed-out callers get a 401 we ignore.
      void authedFetch(PREFERENCES_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ theme: next }),
      }).catch(() => undefined);
    }
  }, []);

  const setTheme = useCallback((next: ThemeName) => applyTheme(next, true), [applyTheme]);
  const toggleTheme = useCallback(
    () => applyTheme(theme === 'comic' ? 'default' : 'comic', true),
    [applyTheme, theme],
  );

  // On first mount: adopt the on-device choice immediately, then reconcile with the
  // server (the source of truth for a signed-in account) so the theme follows the
  // user across devices. Runs once; offline / signed-out keeps the local choice.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    let canceled = false;

    void (async () => {
      const local = await readStoredTheme();
      if (canceled) return;
      if (local !== DEFAULT_THEME) {
        setThemeState(local);
      }
      try {
        const res = await authedFetch(PREFERENCES_PATH);
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; theme?: unknown };
        if (!data?.ok || canceled) return;
        const serverTheme = normalizeTheme(data.theme);
        if (serverTheme !== local) {
          applyTheme(serverTheme, false);
        }
      } catch {
        // no-trace: offline or not signed in, so the local choice stands.
      }
    })();

    return () => {
      canceled = true;
    };
  }, [applyTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, tokens: getThemeTokens(theme), setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
