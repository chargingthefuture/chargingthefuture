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
  BG: string;
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
    BG: tokens.bg,
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

// The admin page's shared styles (beacon-admin-shell.tsx): cardStyle, cardTitleStyle, labelStyle,
// inputStyle, chipButtonStyle, dangerButtonStyle and bannerStyle.
export function adminCardStyle(t: BeaconTokens): ViewStyle {
  return {
    marginTop: 18,
    borderRadius: radius(t, 14),
    backgroundColor: t.HEADER,
    borderWidth: 1,
    borderColor: t.BORDER_SOLID,
    padding: 18,
  };
}

export function cardTitleText(t: BeaconTokens): TextStyle {
  return { color: t.TITLE, fontSize: 16, marginBottom: 12, ...font('700') };
}

export function labelText(t: BeaconTokens): TextStyle {
  return { color: t.SUBTLE, fontSize: 12, marginTop: 8, marginBottom: 4, ...font('600') };
}

// The small bold heading over each part of the Broadcast card.
export function sectionLabelText(t: BeaconTokens): TextStyle {
  return { color: t.SUBTLE, fontSize: 13, marginBottom: 8, ...font('700') };
}

export function inputStyle(t: BeaconTokens): TextStyle {
  return {
    backgroundColor: t.SURFACE,
    borderWidth: 1,
    borderColor: t.BORDER_SOLID,
    borderRadius: radius(t, 10),
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: t.TITLE,
    fontSize: 14,
    marginBottom: 8,
    ...font('400'),
  };
}

export function chipStyle(t: BeaconTokens): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius(t, 8),
    backgroundColor: t.SURFACE,
    borderWidth: 1,
    borderColor: t.BORDER_SOLID,
  };
}

export function chipText(t: BeaconTokens): TextStyle {
  return { color: t.TITLE, fontSize: 13, ...font('600') };
}

// The armed-delete chip: the chip shape, tinted red.
export const DANGER_CHIP: ViewStyle = { backgroundColor: 'rgba(220,38,38,0.16)', borderColor: 'rgba(220,38,38,0.5)' };

export function bannerStyle(t: BeaconTokens, borderColor: string): ViewStyle {
  return {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius(t, 10),
    backgroundColor: t.SURFACE,
    borderWidth: 1,
    borderColor,
  };
}
