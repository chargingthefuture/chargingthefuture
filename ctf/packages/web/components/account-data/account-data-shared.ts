// Shared design tokens and types for the Account & Data surface.
//
// The default-theme tokens mirror the survivor-hub mockups exactly (BRAND `#D946EF`, bg `#0F1117`,
// surface `#161B27`, border `#1E2A3A`, text `#F9FAFB`, subtle `#6B7280`). The shell uses inline
// styles with a `${color}NN` opacity pattern (e.g. `background: ${BRAND}15`) that plain CSS
// variables can't retrofit, so colors are resolved through a theme-aware token object instead.
//
// The comic-theme values come verbatim from the Account & Data comic mockup
// (design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/ComicAccountData.tsx) and
// COMIC_THEME_TOKENS.md §1: bg `#0D0D0D`, surface `#141414`, ink border `#D4C49A`, cream text
// `#EDE3CB`, inkDim secondary `#7A6A50`, and the destructive danger red `#B91C1C` for BRAND.

import type { ThemeName } from '../../lib/theme/theme-tokens';

export type AccountDataTokens = {
  BRAND: string;
  BG: string;
  SURFACE: string;
  BORDER: string;
  TEXT: string;
  SUBTLE: string;
};

const DEFAULT_TOKENS: AccountDataTokens = {
  BRAND: '#D946EF',
  BG: '#0F1117',
  SURFACE: '#161B27',
  BORDER: '#1E2A3A',
  TEXT: '#F9FAFB',
  SUBTLE: '#6B7280',
};

const COMIC_TOKENS: AccountDataTokens = {
  BRAND: '#B91C1C',
  BG: '#0D0D0D',
  SURFACE: '#141414',
  BORDER: '#D4C49A',
  TEXT: '#EDE3CB',
  SUBTLE: '#7A6A50',
};

// Resolve the Account & Data color tokens for the active theme. The default theme returns the
// exact colors the surface already shipped, so it renders pixel-identical when the toggle is off.
export function getAccountDataTokens(theme: ThemeName): AccountDataTokens {
  return theme === 'comic' ? COMIC_TOKENS : DEFAULT_TOKENS;
}

// One service entry as returned by GET /api/account/services. Names and summaries come straight
// from the deletion registry — never hardcoded in the components.
export type AccountService = {
  slug: string;
  name: string;
  summary: string;
  serviceScopeSupported: boolean;
  // Whether the JSON export has anything to read for this service (≥1 user-scoped table). Drives
  // the per-service Export button; absent on older payloads, treated as false.
  exportable?: boolean;
};

export type AccountServicesResponse = {
  ok: boolean;
  deletable: AccountService[];
  retained: AccountService[];
  counts: { deletable: number; retained: number; total: number };
};

// Per-service emoji glyphs, keyed by registry slug. Purely decorative; the registry has no icon
// field, so these live here to match the mockup's per-row glyph. A missing slug falls back to a
// neutral folder glyph.
const SERVICE_GLYPH: Record<string, string> = {
  chyme: '💬',
  directory: '📇',
  'feed-announcements': '📣',
  foundation: '🪛',
  mood: '🌿',
  'peer-programming': '👥',
  lighthouse: '🏠',
  'socket-relay': '🔂',
  'trust-transport': '📦',
  trust: '🛡️',
  workforce: '💼',
  'skills-hunt': '🎯',
  'skills-taxonomy': '🗂️',
  unlock: '🔓',
  'level-up': '🚀',
  'click-log': '🚨',
  comic: '🤖',
  feedback: '💬',
  'service-credits': '⚙️',
  'gross-domestic-product': '📊',
  'weekly-performance': '📊',
};

export function glyphForService(slug: string): string {
  return SERVICE_GLYPH[slug] ?? '📁';
}

// The exact phrase the user must type to confirm full-account deletion (matches the mockup).
export const FULL_ACCOUNT_CONFIRM_PHRASE = 'delete my account';

// Which of the two Account & Data views is showing: the per-service data list, or the
// danger zone (full-account deletion). Lived in the desktop layout until that never-rendered
// layout was removed; it is shared state, so it belongs here with the other shared types.
export type AccountDataView = 'data' | 'danger';
