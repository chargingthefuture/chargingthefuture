import { getAppAccent, type ThemeName } from '../../lib/theme/theme-tokens';

type PluginVisuals = {
  emoji: string;
  color: string;
  bg: string;
};

const PLUGIN_VISUALS: Record<string, PluginVisuals> = {
  chyme: { emoji: '🎙️', color: '#22C55E', bg: '#04160A' },
  lighthouse: { emoji: '🏠', color: '#3B82F6', bg: '#060E1B' },
  'trust-transport': { emoji: '📦', color: '#67E8F9', bg: '#0B1A1B' },
  directory: { emoji: '📇', color: '#93C5FD', bg: '#10161C' },
  foundation: { emoji: '🪛', color: '#F59E0B', bg: '#1B1101' },
  'peer-programming': { emoji: '🏘️', color: '#86EFAC', bg: '#0F1A13' },
  'gross-domestic-product': { emoji: '🗺️', color: '#06B6D4', bg: '#011417' },
  gdp: { emoji: '🗺️', color: '#06B6D4', bg: '#011417' },
  'service-credits': { emoji: '⚙️', color: '#A855F7', bg: '#12091B' },
  workforce: { emoji: '💼', color: '#F97316', bg: '#1B0D02' },
  'gentle-pulse': { emoji: '💚', color: '#6EE7B7', bg: '#0C1914' },
  mood: { emoji: '😁', color: '#BEF264', bg: '#151B0B' },
  'socket-relay': { emoji: '🔂', color: '#FDBA74', bg: '#1C140D' },
  'skills-hunt': { emoji: '🎓', color: '#FACC15', bg: '#1C1602' },
  'feed-announcements': { emoji: '📢', color: '#C4B5FD', bg: '#16141C' },
  'skills-taxonomy': { emoji: '🧩', color: '#8B5CF6', bg: '#0F0A1B' },
  'weekly-performance': { emoji: '📊', color: '#6366F1', bg: '#01162e' },
  'click-log': { emoji: '📍', color: '#EC4899', bg: '#1A0811' },
  'level-up': { emoji: '🎯', color: '#10B981', bg: '#02140E' },
  'what-works': { emoji: '🧰', color: '#84CC16', bg: '#0F1602' },
  beacon: { emoji: '📡', color: '#DC2626', bg: '#180404' },
  contributions: { emoji: '🎁', color: '#F43F5E', bg: '#1B070A' },
  'recurring-activity': { emoji: '🔁', color: '#14B8A6', bg: '#021412' },
  trust: { emoji: '🛡️', color: '#0EA5E9', bg: '#02121A' },
  unlock: { emoji: '🔓', color: '#D946EF', bg: '#18081A' },
};

const FALLBACK: PluginVisuals = { emoji: '🔌', color: '#9CA3AF', bg: '#1a1a2e' };

// In comic theme the per-card surface tint is the flat ink surface (COMIC_THEME_TOKENS.md §1,
// §9 — no neon, no gradients). The accent comes from getAppAccent so the `${color}NN` opacity
// call sites keep working with the deep, ink-compatible accent.
const COMIC_CARD_SURFACE = '#141414';

// Resolve a plugin's emoji, accent color, and card-background base for the active theme. The default
// theme returns the exact colors the shell already shipped (pixel-identical when the toggle is off);
// comic theme swaps the accent to its deep ink variant and flattens the card base to the ink surface.
export function getPluginVisuals(slug: string, theme: ThemeName = 'default'): PluginVisuals {
  const base = PLUGIN_VISUALS[slug] ?? FALLBACK;
  if (theme === 'comic') {
    return { emoji: base.emoji, color: getAppAccent(slug, theme), bg: COMIC_CARD_SURFACE };
  }
  return base;
}
