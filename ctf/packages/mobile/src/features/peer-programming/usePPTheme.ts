// The PeerProgramming colors, copied from the web shell's tokens (getPeerProgrammingTokens in
// web components/peer-programming/pp-shared.ts, built on getPluginShellTokens in
// web components/shared/plugin-shell-theme.ts), so every surface paints the same values as the web.
// The default theme keeps the web's purple tints, which the web shell uses with its green accent.
// The comic theme squares every corner, as the web's comic rule does app-wide.
import { useTheme, getAppAccent } from '../../theme';

export type PPTokens = {
  ACCENT: string;
  BG: string;
  HEADER: string;
  TEXT: string;
  TITLE: string;
  SUBTLE: string;
  MUTED: string;
  FAINT: string;
  BORDER: string;
  BORDER_STRONG: string;
  BORDER_HI: string;
  INPUT_BG: string;
  SURFACE: string;
  /** The admin cards' solid border. */
  BORDER_SOLID: string;
  ACCENT_TINT_BG: string;
  ACCENT_TAB_BORDER: string;
  /** The web's faint card fill, rgba(255,255,255,0.02). */
  CARD_BG: string;
  /** A web corner radius, or 0 in the comic theme. */
  r: (_radius: number) => number;
};

const DEFAULT_ACCENT = '#16A34A';

export function usePPTheme(): PPTokens {
  const { theme } = useTheme();
  if (theme === 'comic') {
    const accent = getAppAccent('peer-programming', 'comic');
    return {
      ACCENT: accent,
      BG: '#0D0D0D',
      HEADER: '#080808',
      TEXT: '#EDE3CB',
      TITLE: '#EDE3CB',
      SUBTLE: '#7A6A50',
      MUTED: '#7A6A50',
      FAINT: '#4A3A2A',
      BORDER: '#D4C49A1A',
      BORDER_STRONG: '#D4C49A2E',
      BORDER_HI: '#D4C49A3A',
      INPUT_BG: '#141414',
      SURFACE: '#141414',
      BORDER_SOLID: '#D4C49A1A',
      ACCENT_TINT_BG: `${accent}1F`,
      ACCENT_TAB_BORDER: `${accent}66`,
      CARD_BG: 'rgba(255,255,255,0.02)',
      r: () => 0,
    };
  }
  return {
    ACCENT: DEFAULT_ACCENT,
    BG: '#0F1117',
    HEADER: '#0D0F14',
    TEXT: '#D5D9E2',
    TITLE: '#D5D9E2',
    SUBTLE: '#9CA3AF',
    MUTED: '#6B7280',
    FAINT: '#4B5563',
    BORDER: 'rgba(255,255,255,0.06)',
    BORDER_STRONG: 'rgba(255,255,255,0.08)',
    BORDER_HI: 'rgba(255,255,255,0.1)',
    INPUT_BG: 'rgba(255,255,255,0.04)',
    SURFACE: '#161B27',
    BORDER_SOLID: '#1E2A3A',
    ACCENT_TINT_BG: 'rgba(139,92,246,0.12)',
    ACCENT_TAB_BORDER: 'rgba(139,92,246,0.4)',
    CARD_BG: 'rgba(255,255,255,0.02)',
    r: (radius) => radius,
  };
}
