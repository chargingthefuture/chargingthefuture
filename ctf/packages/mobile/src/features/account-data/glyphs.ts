// Per-service emoji glyphs, keyed by registry slug, copied from the web's glyphForService
// (components/account-data/account-data-shared.ts). A missing slug falls back to a folder.
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
  'skill-up': '🚀',
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

// The exact phrase the member types to confirm full-account deletion.
export const FULL_ACCOUNT_CONFIRM_PHRASE = 'delete my account';
