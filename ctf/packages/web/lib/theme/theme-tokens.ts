// Theme tokens shared across the app.
//
// Two themes are supported: the original dark UI ('default') and a comic-book dark
// theme ('comic'). Surface colors are driven by CSS custom properties defined in
// app/globals.css; this module owns the parts that live in TypeScript — the theme
// name type, localStorage key, and the per-plugin accent translation table.
//
// The comic-ink accent values are copied verbatim from the design token spec:
// design/artifacts/mockup-sandbox/COMIC_THEME_TOKENS.md §6. Do not invent values.

export type ThemeName = 'default' | 'comic';

export const THEME_NAMES: readonly ThemeName[] = ['default', 'comic'] as const;

export const DEFAULT_THEME: ThemeName = 'default';

// localStorage key + the attribute the toggle sets on <html>. The spec names the
// storage key "sh-theme" (§12.2); we keep that exact key.
export const THEME_STORAGE_KEY = 'sh-theme';
export const THEME_ATTRIBUTE = 'data-theme';

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
  mood: { standard: '#BEF264', comic: '#4A5C1A' },
  'socket-relay': { standard: '#FDBA74', comic: '#7A3A0C' },
  'skills-hunt': { standard: '#FACC15', comic: '#7A5A05' },
  'feed-announcements': { standard: '#C4B5FD', comic: '#3A2A6A' },
  'skill-up': { standard: '#10B981', comic: '#1A5C30' },
  'what-works': { standard: '#84CC16', comic: '#4A6B10' },
  trust: { standard: '#0EA5E9', comic: '#0C5278' },
  'click-log': { standard: '#EC4899', comic: '#7A1A4A' },
  contributions: { standard: '#FB7185', comic: '#7A2A34' },
  'skills-taxonomy': { standard: '#8B5CF6', comic: '#3A2A7A' },
  unlock: { standard: '#D946EF', comic: '#6A1A7A' },
  'weekly-performance': { standard: '#6366F1', comic: '#2A2A6A' },
  // AI Assistant (the @comic plugin) deliberately uses inkDim in comic theme — no blue.
  comic: { standard: '#38BDF8', comic: '#7A6A50' },
  // Account & Data uses comic-danger for its destructive zone.
  'account-data': { standard: '#D946EF', comic: '#B91C1C' },
  // Recurring Activity: a calm teal. Recognition of everyday ties, never a bill — no red or warning tone.
  'recurring-activity': { standard: '#14B8A6', comic: '#0F5C54' },
  // Beacon: a deep red so it never reads as Foundation's amber or Contributions' coral; viewer follows this.
  beacon: { standard: '#B91C1C', comic: '#7A1A1A' },
  // Mutual Time: the rose accent from the design mockups (#F472B6); comic uses a deep ink-pink.
  'mutual-time': { standard: '#F472B6', comic: '#7A1A4A' },
};

const FALLBACK_ACCENT: AccentPair = { standard: '#6B7280', comic: '#7A6A50' };

// Resolve a plugin's accent for the active theme. Unknown slugs fall back to a
// neutral gray (standard) / inkDim (comic) so a new plugin never renders unstyled.
export function getAppAccent(slug: string, theme: ThemeName): string {
  const pair = PLUGIN_ACCENTS[slug] ?? FALLBACK_ACCENT;
  return theme === 'comic' ? pair.comic : pair.standard;
}
