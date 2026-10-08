/**
 * The Beacon screen's colors, sizes and shared styles, copied from the web Beacon screens
 * (components/beacon/beacon-shared.ts and the inline styles in beacon-viewer.tsx and
 * beacon-admin-shell.tsx) so the Android screen paints the same values.
 *
 * The web reads its plugin shell tokens (components/shared/plugin-shell-theme.ts): HEADER is the
 * card background, SURFACE the inset background, BORDER_SOLID the card border and SUBTLE the
 * secondary text. The comic theme flattens every corner to square (web globals.css), so every
 * radius here goes through `radius()`.
 */
import type { TextStyle, ViewStyle } from 'react-native';
import { interFamily } from '../../components/ui';
import { getAppAccent, type ThemeName, type ThemeTokens } from '../../theme';

export type BeaconTokens = {
  ACCENT: string;
  HEADER: string;
  SURFACE: string;
  BORDER_SOLID: string;
  TITLE: string;
  SUBTLE: string;
  isComic: boolean;
};

export function getBeaconTokens(tokens: ThemeTokens, theme: ThemeName): BeaconTokens {
  return {
    ACCENT: getAppAccent('beacon', theme),
    HEADER: tokens.isComic ? '#080808' : '#0D0F14',
    SURFACE: tokens.isComic ? '#141414' : '#161B27',
    BORDER_SOLID: tokens.isComic ? '#D4C49A1A' : '#1E2A3A',
    TITLE: tokens.textPrimary,
    SUBTLE: tokens.textSecondary,
    isComic: tokens.isComic,
  };
}

// The red the web uses for End broadcast, an active host control and error lines.
export const DANGER_TEXT = '#F87171';
export const DANGER_BG = 'rgba(239,68,68,0.14)';
export const DANGER_BORDER = 'rgba(239,68,68,0.35)';

export function radius(t: BeaconTokens, value: number): number {
  return t.isComic ? 0 : value;
}

export function font(weight: TextStyle['fontWeight']): TextStyle {
  return { fontWeight: weight, fontFamily: interFamily(weight) };
}

// web panelStyle (beacon-viewer.tsx).
export function panelStyle(t: BeaconTokens): ViewStyle {
  return {
    marginTop: 20,
    borderRadius: radius(t, 14),
    backgroundColor: t.HEADER,
    borderWidth: 1,
    borderColor: t.BORDER_SOLID,
    padding: 20,
  };
}

// web centeredStyle (beacon-viewer.tsx); the text half is centeredText.
export function centeredStyle(t: BeaconTokens): ViewStyle {
  return { alignItems: 'center', justifyContent: 'center', backgroundColor: t.SURFACE };
}

export function centeredText(t: BeaconTokens): TextStyle {
  return { color: t.SUBTLE, fontSize: 14, textAlign: 'center', ...font('400') };
}

// web ctaStyle (beacon-viewer.tsx) and primaryButtonStyle (beacon-admin-shell.tsx) share this shape.
export function ctaStyle(t: BeaconTokens, paddingHorizontal: number, paddingVertical: number): ViewStyle {
  return {
    alignSelf: 'flex-start',
    paddingVertical,
    paddingHorizontal,
    borderRadius: radius(t, 10),
    backgroundColor: `${t.ACCENT}20`,
    borderWidth: 1,
    borderColor: `${t.ACCENT}55`,
  };
}

export function ctaText(t: BeaconTokens): TextStyle {
  return { color: t.ACCENT, fontSize: 14, ...font('700') };
}
