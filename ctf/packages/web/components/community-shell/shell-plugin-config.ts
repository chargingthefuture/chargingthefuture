import { getAppAccent, type ThemeName } from '../../lib/theme/theme-tokens';

type PluginVisuals = {
  emoji: string;
  color: string;
  bg: string;
};

const PLUGIN_VISUALS: Record<string, PluginVisuals> = {
  chyme: { emoji: '🎙️', color: '#22C55E', bg: '#04160A' },
  lighthouse: { emoji: '🏠', color: '#60A5FA', bg: '#0B121C' },
  trusttransport: { emoji: '📦', color: '#38BDF8', bg: '#06151B' },
  'trust-transport': { emoji: '📦', color: '#38BDF8', bg: '#06151B' },
  directory: { emoji: '📇', color: '#93C5FD', bg: '#10161C' },
  foundation: { emoji: '🪛', color: '#F59E0B', bg: '#1B1101' },
  'peer-programming': { emoji: '🏘️', color: '#6EE7B7', bg: '#0C1914' },
  'gross-domestic-product': { emoji: '🗺️', color: '#06B6D4', bg: '#011417' },
  'service-credits': { emoji: '⚙️', color: '#A855F7', bg: '#12091B' },
  workforce: { emoji: '💼', color: '#F97316', bg: '#1B0D02' },
  gentlepulse: { emoji: '💚', color: '#34D399', bg: '#061711' },
  mood: { emoji: '😁', color: '#4ADE80', bg: '#08180E' },
  socketrelay: { emoji: '🔂', color: '#FB923C', bg: '#1C1007' },
  'skills-hunt': { emoji: '🎓', color: '#FBBF24', bg: '#1C1504' },
  'feed-announcements': { emoji: '📢', color: '#FB923C', bg: '#1c0e03' },
  'skills-taxonomy': { emoji: '🧩', color: '#818CF8', bg: '#0E0F1B' },
  'weekly-performance': { emoji: '📊', color: '#6366F1', bg: '#01162e' },
  clicklog: { emoji: '📍', color: '#EC4899', bg: '#1A0811' },
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
