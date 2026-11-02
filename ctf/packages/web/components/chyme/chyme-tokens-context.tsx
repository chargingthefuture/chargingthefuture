'use client';

import { createContext, useContext } from 'react';
import type { SeThemeTokens } from '@ctf/shared';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, type ChymeTokens } from './chyme-shared';

// Lets a 3.1 screen draw Chyme's parts (the TI Radio guide, guest listening, the readings loop) in
// the 3.1 colors instead of Chyme's green: the screen provides the tokens, and each part reads them
// through useChymeTokens. Without a provider every part keeps Chyme's own colors.

export const ChymeTokensContext = createContext<ChymeTokens | null>(null);

export function useChymeTokens(): ChymeTokens {
  const { theme } = useTheme();
  const override = useContext(ChymeTokensContext);
  return override ?? getChymeTokens(theme);
}

// Chyme's token names filled from the member's 3.1 theme. Every value is a hex color, so the parts
// that add an alpha suffix (`${ACCENT}30`) keep working.
export function seChymeTokens(t: SeThemeTokens): ChymeTokens {
  const accent = t.btn;
  return {
    ACCENT: accent,
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
    BORDER_HI: t.line,
    INPUT_BG: t.sunk,
    SURFACE: t.card,
    BORDER_SOLID: t.hair,
    ACCENT_TINT_10: `${accent}1A`,
    ACCENT_TINT_15: `${accent}26`,
    ACCENT_TINT_30: `${accent}4D`,
    ACCENT_TINT_40: `${accent}66`,
  };
}
