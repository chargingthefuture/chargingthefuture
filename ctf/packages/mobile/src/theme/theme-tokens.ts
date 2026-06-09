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
  lighthouse: { standard: '#60A5FA', comic: '#1A4A7A' },
  trusttransport: { standard: '#38BDF8', comic: '#0C4A6E' },
  directory: { standard: '#93C5FD', comic: '#1A3A6A' },
  foundation: { standard: '#F59E0B', comic: '#7A4A05' },
  'peer-programming': { standard: '#6EE7B7', comic: '#1A5C40' },
  gdp: { standard: '#06B6D4', comic: '#0E5A68' },
  'gross-domestic-product': { standard: '#06B6D4', comic: '#0E5A68' },
  'service-credits': { standard: '#A855F7', comic: '#5C2C8A' },
  workforce: { standard: '#F97316', comic: '#6A2A05' },
  gentlepulse: { standard: '#34D399', comic: '#1A5C45' },
  mood: { standard: '#4ADE80', comic: '#1A5C2A' },
  socketrelay: { standard: '#FB923C', comic: '#7A3A0C' },
  'skills-hunt': { standard: '#FBBF24', comic: '#7A5A05' },
  levelup: { standard: '#22C55E', comic: '#1A5C30' },
  whatworks: { standard: '#84CC16', comic: '#4A6B10' },
  'what-works': { standard: '#84CC16', comic: '#4A6B10' },
  trust: { standard: '#0EA5E9', comic: '#0C5278' },
  clicklog: { standard: '#EC4899', comic: '#7A1A4A' },
  'skills-taxonomy': { standard: '#818CF8', comic: '#2A2A7A' },
  unlock: { standard: '#C084FC', comic: '#5C1A8A' },
  'weekly-performance': { standard: '#6366F1', comic: '#2A2A6A' },
  // AI Assistant (the @comic plugin) deliberately uses inkDim in comic theme — no blue.
  comic: { standard: '#38BDF8', comic: '#7A6A50' },
  // Account & Data uses comic-danger for its destructive zone.
  'account-data': { standard: '#E91E8C', comic: '#B91C1C' },
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
  /** Primary body text. */
  textPrimary: string;
  /** Secondary text, descriptions, timestamps. */
  textSecondary: string;
  /** Deeply muted text — disabled / fine print. */
  textMuted: string;
  /** Destructive / danger colour. */
  danger: string;
  /** Success / live indicator. */
  success: string;
  /** Warm gold accent — hero stats, progress, economy callouts. */
  gold: string;
  /** Border radius applied to cards / buttons (0 in comic theme). */
  radius: number;
  /** Border radius for chips / badges (2 in comic theme). */
  radiusChip: number;
  /** True when the comic theme is active — lets a screen branch on flat styling. */
  isComic: boolean;
};

const DEFAULT_TOKENS: ThemeTokens = {
  bg: '#0F1117',
  surface: '#161B27',
  surfaceAlt: '#090B0F',
  border: '#1E2A3A',
  borderDim: '#283548',
  borderFaint: 'rgba(255,255,255,0.06)',
  textPrimary: '#F9FAFB',
  textSecondary: '#6B7280',
  textMuted: '#4B5563',
  danger: '#EF4444',
  success: '#22C55E',
  gold: '#C8A84B',
  radius: 12,
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
  textSecondary: '#7A6A50',
  textMuted: '#4A3A2A',
  danger: '#B91C1C',
  success: '#22C55E',
  gold: '#C8A84B',
  radius: 0,
  radiusChip: 2,
  isComic: true,
};

export function getThemeTokens(theme: ThemeName): ThemeTokens {
  return theme === 'comic' ? COMIC_TOKENS : DEFAULT_TOKENS;
}
