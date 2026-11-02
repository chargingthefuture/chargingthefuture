// The Chyme screen's colors, copied from the web Chyme shell (web components/chyme/chyme-shared.ts
// getChymeTokens, built on components/shared/plugin-shell-theme.ts). The web paints Chyme with its
// own deep-green surfaces in the default theme and the shared comic surfaces in the comic theme, so
// this is a copy of those two value sets rather than the app-wide theme tokens.
//
// The comic theme on the web squares every corner (globals.css sets border-radius: 0 on every
// element under the comic theme), so `radius` returns 0 there and the web value otherwise.

import { createContext, useContext, useMemo } from 'react';
import type { SeThemeTokens } from '@ctf/shared';
import { useTheme, getAppAccent, type ThemeName } from '../../theme';
import { openWebPage } from '../../navigation/openWebPage';
import { reportError } from '../../observability/report';

export type ChymeTokens = {
  ACCENT: string;
  BG: string;
  HEADER: string;
  RAIL: string;
  TEXT: string;
  TITLE: string;
  SUBTLE: string;
  MUTED: string;
  FAINT: string;
  BORDER: string;
  BORDER_STRONG: string;
  INPUT_BG: string;
  ACCENT_TINT_15: string;
  ACCENT_TINT_40: string;
  isComic: boolean;
  radius: (_web: number) => number;
};

const square = () => 0;
const keep = (web: number) => web;

// The shared plugin-shell colors (web components/shared/plugin-shell-theme.ts) with the Chyme
// accent: what the web Chyme admin screens paint.
export function getShellTokens(theme: ThemeName): ChymeTokens {
  if (theme === 'comic') {
    const accent = getAppAccent('chyme', 'comic');
    return {
      ACCENT: accent,
      BG: '#0D0D0D',
      HEADER: '#080808',
      RAIL: '#080808',
      TEXT: '#EDE3CB',
      TITLE: '#EDE3CB',
      SUBTLE: '#7A6A50',
      MUTED: '#7A6A50',
      FAINT: '#4A3A2A',
      BORDER: '#D4C49A1A',
      BORDER_STRONG: '#D4C49A2E',
      INPUT_BG: '#141414',
      ACCENT_TINT_15: `${accent}26`,
      ACCENT_TINT_40: `${accent}66`,
      isComic: true,
      radius: square,
    };
  }
  return {
    ACCENT: '#22C55E',
    BG: '#0F1117',
    HEADER: '#0D0F14',
    RAIL: '#090B0F',
    TEXT: '#D5D9E2',
    TITLE: '#D5D9E2',
    SUBTLE: '#9CA3AF',
    MUTED: '#6B7280',
    FAINT: '#4B5563',
    BORDER: 'rgba(255,255,255,0.06)',
    BORDER_STRONG: 'rgba(255,255,255,0.08)',
    INPUT_BG: 'rgba(255,255,255,0.04)',
    ACCENT_TINT_15: 'rgba(34,197,94,0.15)',
    ACCENT_TINT_40: 'rgba(34,197,94,0.4)',
    isComic: false,
    radius: keep,
  };
}

// The member Chyme page: the shell colors, with Chyme's own deep-green surfaces in the default theme.
export function getChymeTokens(theme: ThemeName): ChymeTokens {
  const shell = getShellTokens(theme);
  if (theme === 'comic') return shell;
  return { ...shell, BG: '#04160A', HEADER: '#030d05', RAIL: '#030d05', TITLE: '#F0FDF4', BORDER: '#052e16' };
}

// Lets a 3.1 screen draw Chyme's parts in the 3.1 colors (the Android copy of the web's
// chyme-tokens-context.tsx); without a provider every part keeps Chyme's own colors.
export const ChymeTokensContext = createContext<ChymeTokens | null>(null);

export function useChymeTokens(): ChymeTokens {
  const { theme } = useTheme();
  const override = useContext(ChymeTokensContext);
  const own = useMemo(() => getChymeTokens(theme), [theme]);
  return override ?? own;
}

// Chyme's token names filled from the member's 3.1 theme, as the web's seChymeTokens does.
export function seChymeTokens(t: SeThemeTokens): ChymeTokens {
  return {
    ACCENT: t.btn,
    BG: t.bg,
    HEADER: t.bg,
    RAIL: t.bg,
    TEXT: t.ink,
    TITLE: t.ink,
    SUBTLE: t.soft,
    MUTED: t.soft,
    FAINT: t.soft,
    BORDER: t.hair,
    BORDER_STRONG: t.hair,
    INPUT_BG: t.sunk,
    ACCENT_TINT_15: `${t.btn}26`,
    ACCENT_TINT_40: `${t.btn}66`,
    isComic: false,
    radius: keep,
  };
}

export function useShellTokens(): ChymeTokens {
  const { theme } = useTheme();
  return useMemo(() => getShellTokens(theme), [theme]);
}

// The web's initials helper, unchanged: the first letter of each space-separated word, two at most.
export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// The web links to its own pages (the TI Radio guide, the Weavers explainer). The app opens the same
// page of the web app in a browser panel over the app.
export function openWebPath(path: string): void {
  openWebPage(path, 'chyme').catch((linkError: unknown) => reportError(linkError, { area: 'chyme', op: 'open_on_web' }));
}
