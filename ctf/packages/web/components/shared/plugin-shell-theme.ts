// Shared chrome color tokens for plugin web shells.
//
// Every plugin shell paints the same chrome surfaces with the same default-dark hex values
// (page background #0F1117, header #0D0F14, body text and title both #D5D9E2, two gray
// text tones #9CA3AF and #6B7280, faint #4B5563, and white-alpha borders). This helper returns
// those exact values for the default theme — so a shell renders pixel-identical when the comic
// toggle is off — and the comic surface tokens from COMIC_THEME_TOKENS.md when it is on.
//
// The per-plugin accent is passed in (resolved by the caller via getAppAccent(slug, theme)),
// because each shell owns its own accent token. The `${color}NN` opacity call sites in the
// shells work against ACCENT only; the other tokens are custom properties (see shellVar).

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

// Each chrome color is a --ctf-shell-* custom property falling back to the shipped value, so a
// member screen draws exactly as before and the admin screens, inside AdminSeScope
// (admin-se-scope.module.css), take the 3.1 colors. Only ACCENT stays a bare hex, because the shells
// add an alpha suffix to it (`${ACCENT}22`); never add one to the colors below.
export function shellVar(name: string, fallback: string): string {
  return `var(--ctf-shell-${name}, ${fallback})`;
}

// Build the chrome token set for a shell. `accent` is the already-resolved accent for the
// active theme (default keeps the shell's shipped accent; comic uses the comic-ink accent).
export function getPluginShellTokens(accent: string, theme: ThemeName): PluginShellTokens {
  if (theme === 'comic') {
    return {
      ACCENT: accent,
      BG: shellVar('bg', '#0D0D0D'), // comic-bg
      HEADER: shellVar('header', '#080808'), // comic-surface-alt (deepest chrome)
      RAIL: shellVar('rail', '#080808'), // comic-surface-alt (icon rail)
      TEXT: shellVar('text', '#EDE3CB'), // comic-text-primary
      TITLE: shellVar('title', '#EDE3CB'), // comic-text-primary
      SUBTLE: shellVar('subtle', '#7A6A50'), // comic-text-secondary
      MUTED: shellVar('muted', '#7A6A50'), // comic-text-secondary
      FAINT: shellVar('faint', '#4A3A2A'), // comic-text-muted
      BORDER: shellVar('border', '#D4C49A1A'), // comic-border-faint
      BORDER_STRONG: shellVar('border-strong', '#D4C49A2E'),
      BORDER_HI: shellVar('border-hi', '#D4C49A3A'),
      INPUT_BG: shellVar('input-bg', '#141414'), // comic-surface
      SURFACE: shellVar('surface', '#141414'), // comic-surface
      BORDER_SOLID: shellVar('border-solid', '#D4C49A1A'), // comic-border-faint (click-log precedent for #1E2A3A)
    };
  }
  return {
    ACCENT: accent,
    BG: shellVar('bg', '#0F1117'),
    HEADER: shellVar('header', '#0D0F14'),
    RAIL: shellVar('rail', '#090B0F'),
    // Body text and title are the same value (owner decision, 2026-09-21). They used to be
    // #E8EAF0 and #F9FAFB — seventeen points apart on each channel, which no screen shows as a
    // difference, and both close enough to white to read as glare on a phone at night. The
    // hierarchy that does the work is this value against SUBTLE, MUTED and FAINT below, plus
    // weight and size. The comic theme has always set these two to one value for the same reason.
    TEXT: shellVar('text', '#D5D9E2'),
    TITLE: shellVar('title', '#D5D9E2'),
    SUBTLE: shellVar('subtle', '#9CA3AF'),
    MUTED: shellVar('muted', '#6B7280'),
    FAINT: shellVar('faint', '#4B5563'),
    BORDER: shellVar('border', 'rgba(255,255,255,0.06)'),
    BORDER_STRONG: shellVar('border-strong', 'rgba(255,255,255,0.08)'),
    BORDER_HI: shellVar('border-hi', 'rgba(255,255,255,0.1)'),
    INPUT_BG: shellVar('input-bg', 'rgba(255,255,255,0.04)'),
    SURFACE: shellVar('surface', '#161B27'),
    BORDER_SOLID: shellVar('border-solid', '#1E2A3A'),
  };
}
