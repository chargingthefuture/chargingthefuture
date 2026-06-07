'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_THEME,
  normalizeTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  type ThemeName,
} from '@/lib/theme/theme-tokens';

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Read whatever the no-flash inline script already wrote to <html data-theme>, so the
// provider's initial state matches the first paint and there is no flicker on hydration.
function readInitialTheme(): ThemeName {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return normalizeTheme(document.documentElement.getAttribute(THEME_ATTRIBUTE));
}

function applyThemeAttribute(theme: ThemeName): void {
  if (typeof document === 'undefined') return;
  // The default theme is the absence of the attribute, so removing it keeps the
  // default selectors winning and avoids a stray `data-theme="default"` in the DOM.
  if (theme === 'comic') {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, 'comic');
  } else {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start at the default theme so the first client render matches the server-rendered
  // HTML (no hydration mismatch). The real choice is reconciled in the mount effect
  // below — the page chrome itself is already correct via the no-flash inline script,
  // so only theme-dependent React UI (e.g. the toggle indicator) settles after mount.
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);
  const didInit = useRef(false);

  const applyTheme = useCallback((next: ThemeName, persistToServer: boolean) => {
    setThemeState(next);
    applyThemeAttribute(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — the in-memory + attribute state still applies.
    }
    if (persistToServer) {
      // Best-effort sync to the signed-in user's profile so the choice follows the
      // account across devices. Unauthenticated callers get a 401 we quietly ignore.
      void fetch('/api/account/ui-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        credentials: 'same-origin',
        body: JSON.stringify({ theme: next }),
      }).catch(() => undefined);
    }
  }, []);

  const setTheme = useCallback((next: ThemeName) => applyTheme(next, true), [applyTheme]);
  const toggleTheme = useCallback(
    () => applyTheme(theme === 'comic' ? 'default' : 'comic', true),
    [applyTheme, theme],
  );

  // On first mount: (1) adopt whatever the no-flash script already applied from
  // localStorage so React state matches the visible chrome, then (2) pull the signed-in
  // user's saved theme — the server is the source of truth for a logged-in account, so
  // it follows them across devices. Runs once; failures / unauthenticated are ignored.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const local = readInitialTheme();
    if (local !== DEFAULT_THEME) {
      setThemeState(local);
    }

    void (async () => {
      try {
        const res = await fetch('/api/account/ui-preferences', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data: { ok?: boolean; theme?: unknown } = await res.json();
        if (!data?.ok) return;
        const serverTheme = normalizeTheme(data.theme);
        if (serverTheme !== local) {
          applyTheme(serverTheme, false);
        }
      } catch {
        // Offline or not signed in — keep the local choice.
      }
    })();
  }, [applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
