// Shared design tokens and types for the Account & Data surface.
//
// Tokens mirror the survivor-hub mockups exactly (BRAND `#E91E8C`, bg `#0F1117`, surface `#161B27`,
// border `#1E2A3A`, text `#F9FAFB`, subtle `#6B7280`). The shell uses inline styles to match the
// mockup conventions for this surface.

export const BRAND = '#E91E8C';
export const BG = '#0F1117';
export const SURFACE = '#161B27';
export const BORDER = '#1E2A3A';
export const TEXT = '#F9FAFB';
export const SUBTLE = '#6B7280';

// One service entry as returned by GET /api/account/services. Names and summaries come straight
// from the deletion registry — never hardcoded in the components.
export type AccountService = {
  slug: string;
  name: string;
  summary: string;
  serviceScopeSupported: boolean;
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
  gentlepulse: '🎵',
  'peer-programming': '👥',
  lighthouse: '🏠',
  socketrelay: '🔂',
  trusttransport: '📦',
  trust: '🛡️',
  workforce: '💼',
  'skills-hunt': '🎯',
  'skills-taxonomy': '🗂️',
  unlock: '🔓',
  levelup: '🚀',
  clicklog: '🚨',
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
