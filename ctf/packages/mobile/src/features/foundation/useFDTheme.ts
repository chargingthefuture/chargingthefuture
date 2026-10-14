// The Foundation colors, copied from the web: getFoundationTokens (components/foundation/foundation-ui.ts)
// over getPluginShellTokens (components/shared/plugin-shell-theme.ts). The default theme keeps the web's
// shipped values; comic uses the comic surface tokens and the Foundation comic accent. The web comic
// theme also squares every corner (globals.css sets border-radius to 0 in comic), so `r()` does the same.
import type { TextStyle } from 'react-native';
import { useTheme, getAppAccent, type ThemeName } from '../../theme';
import { interFamily } from '../../components/ui';

export const FOUNDATION_COLOR = '#F59E0B';

export type FDTokens = {
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
  BORDER_SOLID: string;
};

const COMIC: Omit<FDTokens, 'ACCENT'> = {
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
};

const DEFAULT: Omit<FDTokens, 'ACCENT'> = {
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
};

// The web getPluginShellTokens for any accent: the chrome colors around it.
export function getShellTokens(accent: string, theme: ThemeName): FDTokens {
  return theme === 'comic' ? { ACCENT: accent, ...COMIC } : { ACCENT: accent, ...DEFAULT };
}

export function getFoundationTokens(theme: ThemeName): FDTokens {
  return getShellTokens(theme === 'comic' ? getAppAccent('foundation', 'comic') : FOUNDATION_COLOR, theme);
}

export type FDTheme = { t: FDTokens; r: (_radius: number) => number; isComic: boolean };

export function useFDTheme(): FDTheme {
  const { theme } = useTheme();
  const isComic = theme === 'comic';
  return { t: getFoundationTokens(theme), r: (radius: number) => (isComic ? 0 : radius), isComic };
}

// Size, weight and the matching Inter face, so a style reads like the web inline style it copies.
export function font(size: number, weight: TextStyle['fontWeight'] = '400'): TextStyle {
  return { fontSize: size, fontWeight: weight, fontFamily: interFamily(weight) };
}

// The web's `${accent}NN` alpha suffix on a #RRGGBB color.
export function alpha(color: string, hex: string): string {
  return `${color}${hex}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
