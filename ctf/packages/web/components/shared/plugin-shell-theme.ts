// Shared chrome color tokens for plugin web shells.
//
// Every plugin shell paints the same chrome surfaces with the same default-dark hex values
// (page background #0F1117, header #0D0F14, body text #E8EAF0, bright title #F9FAFB, two gray
// text tones #9CA3AF and #6B7280, faint #4B5563, and white-alpha borders). This helper returns
// those exact values for the default theme — so a shell renders pixel-identical when the comic
// toggle is off — and the comic surface tokens from COMIC_THEME_TOKENS.md when it is on.
//
// The per-plugin accent is passed in (resolved by the caller via getAppAccent(slug, theme)),
// because each shell owns its own accent token. The `${color}NN` opacity call sites in the
// shells keep working against ACCENT and the white-alpha BORDER tokens unchanged.

import { type ThemeName } from '../../lib/theme/theme-tokens';

export type PluginShellTokens = {
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
  BORDER_HI: string;
  INPUT_BG: string;
  // Admin/raised-card palette shared by every admin shell (and some member cards):
  // solid card surface + solid structural border, distinct from the white-alpha borders.
  // Values mirror --ctf-surface / --ctf-border(-faint) in app/globals.css for each theme.
  SURFACE: string;
  BORDER_SOLID: string;
};

// Build the chrome token set for a shell. `accent` is the already-resolved accent for the
// active theme (default keeps the shell's shipped accent; comic uses the comic-ink accent).
export function getPluginShellTokens(accent: string, theme: ThemeName): PluginShellTokens {
  if (theme === 'comic') {
    return {
      ACCENT: accent,
      BG: '#0D0D0D', // comic-bg
      HEADER: '#080808', // comic-surface-alt (deepest chrome)
      RAIL: '#080808', // comic-surface-alt (icon rail)
      TEXT: '#EDE3CB', // comic-text-primary
      TITLE: '#EDE3CB', // comic-text-primary
      SUBTLE: '#7A6A50', // comic-text-secondary
      MUTED: '#7A6A50', // comic-text-secondary
      FAINT: '#4A3A2A', // comic-text-muted
      BORDER: '#D4C49A1A', // comic-border-faint
      BORDER_STRONG: '#D4C49A2E',
      BORDER_HI: '#D4C49A3A',
      INPUT_BG: '#141414', // comic-surface
      SURFACE: '#141414', // comic-surface
      BORDER_SOLID: '#D4C49A1A', // comic-border-faint (click-log precedent for #1E2A3A)
    };
  }
  return {
    ACCENT: accent,
    BG: '#0F1117',
    HEADER: '#0D0F14',
    RAIL: '#090B0F',
    TEXT: '#E8EAF0',
    TITLE: '#F9FAFB',
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
}
