// Theme tokens for the mobile app — mirrors the web's lib/theme/theme-tokens.ts.
//
// Two themes are supported: the original dark UI ('default') and a comic-book dark
// theme ('comic'). The web drives surface colors through CSS custom properties; React
// Native has no CSS variables, so this module also exposes a flat palette object
// (getThemeTokens) that each screen reads to colour its StyleSheet. The theme name
// type, storage key, and per-plugin accent table match the web verbatim so a user's
// choice stays in sync across web and mobile through /api/account/ui-preferences.
//
// Comic-ink values are copied verbatim from the design token spec:
// design/artifacts/mockup-sandbox/COMIC_THEME_TOKENS.md. Do not invent values.

export type ThemeName = 'default' | 'comic';

export const THEME_NAMES: readonly ThemeName[] = ['default', 'comic'] as const;

export const DEFAULT_THEME: ThemeName = 'default';

// Storage key — the web uses "sh-theme" (spec §12.2). We keep the exact same key so
// the on-device value and the server value line up with the web client.
export const THEME_STORAGE_KEY = 'sh-theme';

export function isThemeName(value: unknown): value is ThemeName {
  return value === 'default' || value === 'comic';
}

export function normalizeTheme(value: unknown): ThemeName {
  return isThemeName(value) ? value : DEFAULT_THEME;
}

// Per-plugin accent translation. Keyed by plugin slug. `standard` is the accent the
// app already uses; `comic` is the deep, ink-compatible variant (no neon, no glow).
type AccentPair = { standard: string; comic: string };

export const PLUGIN_ACCENTS: Record<string, AccentPair> = {
  chyme: { standard: '#22C55E', comic: '#1A5C32' },
  lighthouse: { standard: '#3B82F6', comic: '#1A4A7A' },
  'trust-transport': { standard: '#67E8F9', comic: '#0C4A5E' },
  directory: { standard: '#93C5FD', comic: '#1A3A6A' },
  foundation: { standard: '#F59E0B', comic: '#7A4A05' },
  'peer-programming': { standard: '#16A34A', comic: '#1A5C40' },
  gdp: { standard: '#06B6D4', comic: '#0E5A68' },
  'gross-domestic-product': { standard: '#06B6D4', comic: '#0E5A68' },
  'service-credits': { standard: '#A855F7', comic: '#5C2C8A' },
  workforce: { standard: '#F97316', comic: '#6A2A05' },
  'gentle-pulse': { standard: '#6EE7B7', comic: '#1A5C45' },
  mood: { standard: '#BEF264', comic: '#4A5C1A' },
  'socket-relay': { standard: '#FDBA74', comic: '#7A3A0C' },
  'skills-hunt': { standard: '#FACC15', comic: '#7A5A05' },
  'level-up': { standard: '#10B981', comic: '#1A5C30' },
  'what-works': { standard: '#84CC16', comic: '#4A6B10' },
  trust: { standard: '#0EA5E9', comic: '#0C5278' },
  'click-log': { standard: '#EC4899', comic: '#7A1A4A' },
  'skills-taxonomy': { standard: '#8B5CF6', comic: '#3A2A7A' },
  unlock: { standard: '#D946EF', comic: '#6A1A7A' },
  'weekly-performance': { standard: '#6366F1', comic: '#2A2A6A' },
  // AI Assistant (the @comic plugin) deliberately uses inkDim in comic theme — no blue.
  comic: { standard: '#38BDF8', comic: '#7A6A50' },
  // Account & Data uses comic-danger for its destructive zone.
  'account-data': { standard: '#D946EF', comic: '#B91C1C' },
  // Beacon: a deep red so it never reads as Foundation's amber or Contributions' coral; matches web.
  beacon: { standard: '#B91C1C', comic: '#7A1A1A' },
  // Recurring Activity: a calm teal. Matches the web accent table verbatim.
  'recurring-activity': { standard: '#14B8A6', comic: '#0F5C54' },
};

const FALLBACK_ACCENT: AccentPair = { standard: '#6B7280', comic: '#7A6A50' };

// Resolve a plugin's accent for the active theme. Unknown slugs fall back to a
// neutral grey (standard) / inkDim (comic) so a new plugin never renders unstyled.
export function getAppAccent(slug: string, theme: ThemeName): string {
  const pair = PLUGIN_ACCENTS[slug] ?? FALLBACK_ACCENT;
  return theme === 'comic' ? pair.comic : pair.standard;
}

// Flat palette a screen reads to colour its StyleSheet. The comic side is copied
// verbatim from COMIC_THEME_TOKENS.md sections 1-2; the default side keeps the existing
// dark palette the shipped screens already use so 'default' is visually unchanged.
export type ThemeTokens = {
  /** Root page background — outermost container. */
  bg: string;
  /** Panels, cards, header bars. */
  surface: string;
  /** Deepest chrome — icon rail / status bar (darker than surface). */
  surfaceAlt: string;
  /** Primary hard border colour. */
  border: string;
  /** Dimmed / secondary border colour. */
  borderDim: string;
  /** Very faint row-divider tint. */
  borderFaint: string;
  /** Primary body text (brightest). Mirrors web `--ctf-text`. */
  textPrimary: string;
  /** Body/shell text — one step below primary. Mirrors web `--ctf-text-shell`. */
  textShell: string;
  /** Secondary text, descriptions, timestamps. Mirrors web `--ctf-text-secondary`. */
  textSecondary: string;
  /** Deeply muted text — disabled / fine print. */
  textMuted: string;
  /** Destructive / danger colour. */
  danger: string;
  /** Success / live indicator. */
  success: string;
  /** Highlight accent — hero stats, progress, economy callouts. Mirrors web `--ctf-gold`
   *  (sky `#38BDF8` in default, warm gold `#C8A84B` in comic). */
  gold: string;
  /** Brand hue. Mirrors web `--ctf-brand` (pink `#E91E8C` in default, warm gold `#C8A84B` in comic). */
  brand: string;
  /** Text/icon colour that sits on a `brand` fill. Mirrors web `--ctf-brand-text`. */
  brandText: string;
  /** Border radius applied to cards (0 in comic theme). Mirrors web `--ctf-card-radius`. */
  radius: number;
  /** Border radius for controls — buttons / inputs (0 in comic theme). Mirrors web `--ctf-control-radius`. */
  radiusControl: number;
  /** Border radius for chips / badges (2 in comic theme). Mirrors web `--ctf-chip-radius`. */
  radiusChip: number;
  /** True when the comic theme is active — lets a screen branch on flat styling. */
  isComic: boolean;
};

// Default palette. Values mirror the web token layer (app/globals.css `:root`) field-for-field so the
// two platforms render the same default theme (owner decision 2026-07-10: web is the reference).
// Web equivalents: bg=--ctf-bg, surface=--ctf-surface, surfaceAlt=--ctf-icon-rail, border=--ctf-border,
// borderDim=--ctf-border-dim, textPrimary=--ctf-text, textSecondary=--ctf-text-secondary,
// textMuted=--ctf-text-muted, danger=--ctf-danger, success=--ctf-success, gold=--ctf-gold,
// radius=--ctf-card-radius, radiusChip=--ctf-chip-radius.
const DEFAULT_TOKENS: ThemeTokens = {
  bg: '#0F1117',
  surface: '#161B27',
  surfaceAlt: '#090B0F',
  border: '#1E2A3A',
  borderDim: '#1E2A3A',
  borderFaint: 'rgba(255,255,255,0.06)',
  textPrimary: '#F9FAFB',
  textShell: '#E8EAF0',
  textSecondary: '#9CA3AF',
  textMuted: '#4B5563',
  danger: '#B91C1C',
  success: '#22C55E',
  gold: '#38BDF8',
  brand: '#E91E8C',
  brandText: '#FFFFFF',
  radius: 14,
  radiusControl: 10,
  radiusChip: 6,
  isComic: false,
};

const COMIC_TOKENS: ThemeTokens = {
  bg: '#0D0D0D',
  surface: '#141414',
  surfaceAlt: '#080808',
  border: '#D4C49A',
  borderDim: '#7A6A50',
  borderFaint: 'rgba(212,196,154,0.1)',
  textPrimary: '#EDE3CB',
  textShell: '#EDE3CB',
  textSecondary: '#7A6A50',
  textMuted: '#4A3A2A',
  danger: '#B91C1C',
  success: '#22C55E',
  gold: '#C8A84B',
  brand: '#C8A84B',
  brandText: '#0D0D0D',
  radius: 0,
  radiusControl: 0,
  radiusChip: 2,
  isComic: true,
};

export function getThemeTokens(theme: ThemeName): ThemeTokens {
  return theme === 'comic' ? COMIC_TOKENS : DEFAULT_TOKENS;
}
