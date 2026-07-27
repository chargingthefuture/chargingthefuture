// Per-plugin emoji map — ports web's components/community-shell/shell-plugin-config.ts PLUGIN_VISUALS.
//
// The launcher renders a tile per plugin; the emoji is the tile glyph. The accent already comes from
// getAppAccent (theme-tokens.ts), so this file only carries the emoji half of web's PLUGIN_VISUALS.
// Every slug web ships is covered here; unknown slugs fall back to the plug glyph so a new plugin
// still renders.

import { getAppAccent, type ThemeName } from './theme-tokens';

export const PLUGIN_EMOJI: Record<string, string> = {
  chyme: '🎙️',
  lighthouse: '🏠',
  'trust-transport': '📦',
  directory: '📇',
  foundation: '🪛',
  'peer-programming': '🏘️',
  gdp: '🗺️',
  'gross-domestic-product': '🗺️',
  'service-credits': '⚙️',
  workforce: '💼',
  mood: '😁',
  'socket-relay': '🔂',
  'skills-hunt': '🎓',
  'feed-announcements': '📢',
  'skills-taxonomy': '🧩',
  'weekly-performance': '📊',
  'click-log': '📍',
  'level-up': '🎯',
  'what-works': '🧰',
  beacon: '📡',
  contributions: '🎁',
  'recurring-activity': '🔁',
  trust: '🛡️',
  unlock: '🔓',
};

const FALLBACK_EMOJI = '🔌';

// Resolve a plugin's tile emoji. Unknown slugs get the plug glyph so a new plugin never renders blank.
export function getPluginEmoji(slug: string): string {
  return PLUGIN_EMOJI[slug] ?? FALLBACK_EMOJI;
}

// Combined tile visuals — emoji (from here) + accent (from theme-tokens' getAppAccent) for the active
// theme. Convenience for the launcher so it can pull both in one call.
export function getPluginTileVisuals(
  slug: string,
  theme: ThemeName = 'default',
): { emoji: string; accent: string } {
  return { emoji: getPluginEmoji(slug), accent: getAppAccent(slug, theme) };
}
