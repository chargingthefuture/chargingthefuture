import { getAppAccent, type ThemeName } from '../../lib/theme/theme-tokens';

type PluginVisuals = {
  emoji: string;
  color: string;
  bg: string;
};

const PLUGIN_VISUALS: Record<string, PluginVisuals> = {
  chyme: { emoji: '🎙️', color: '#22C55E', bg: '#052e16' },
  lighthouse: { emoji: '🏠', color: '#EAB308', bg: '#1c1407' },
  trusttransport: { emoji: '📦', color: '#F97316', bg: '#1c0a03' },
  'trust-transport': { emoji: '📦', color: '#F97316', bg: '#1c0a03' },
  directory: { emoji: '📇', color: '#3B82F6', bg: '#0c1a3d' },
  foundation: { emoji: '🪛', color: '#EF4444', bg: '#1c0505' },
  'peer-programming': { emoji: '🏘️', color: '#8B5CF6', bg: '#150d2e' },
  'gross-domestic-product': { emoji: '🗺️', color: '#06B6D4', bg: '#011c26' },
  'service-credits': { emoji: '⚙️', color: '#F59E0B', bg: '#1c1200' },
  workforce: { emoji: '💼', color: '#6366F1', bg: '#0e0f30' },
  gentlepulse: { emoji: '💚', color: '#14B8A6', bg: '#011c1a' },
  mood: { emoji: '😁', color: '#EC4899', bg: '#1c0416' },
  socketrelay: { emoji: '🔂', color: '#F43F5E', bg: '#1c0409' },
  'skills-hunt': { emoji: '🎓', color: '#A78BFA', bg: '#130d2e' },
  'feed-announcements': { emoji: '📢', color: '#FB923C', bg: '#1c0e03' },
  'skills-taxonomy': { emoji: '🧩', color: '#10B981', bg: '#041a0f' },
  'weekly-performance': { emoji: '📊', color: '#38BDF8', bg: '#01162e' },
  clicklog: { emoji: '📍', color: '#6366F1', bg: '#f5f5fa' },
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
