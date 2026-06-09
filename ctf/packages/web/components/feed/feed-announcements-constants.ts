// Design-sync colour tokens — copied verbatim from design mockup COLOR const

import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const FEED_COLOR = '#84CC16';
export const FEED_BG = '#0F1117';
export const FEED_RAIL_BG = '#090B0F';
export const FEED_SIDEBAR_BG = '#0D0F14';

// Theme-aware chrome tokens for the live feed shell. The feed paints its lime accent both as the
// solid #84CC16 and as rgba(132,204,22,…) tints; the default theme returns those exact strings so
// the shell renders identically when the comic toggle is off. The feed plugin has no comic-spec
// accent of its own, so comic resolves the shared fallback ink-dim accent via
// getAppAccent('feed-announcements', 'comic'); the rgba tints map to that accent at matching alpha.
// Comic uses the shared comic surface tokens plus that accent.
export type FeedTokens = PluginShellTokens & {
  ACCENT_TINT_05: string; // faint accent wash (default 0.05)
  ACCENT_TINT_10: string; // empty-state icon background (default 0.1)
  ACCENT_TINT_20: string; // empty-state icon border / chat frame (default 0.2)
  ACCENT_TINT_30: string; // empty-state list dot (default 0.3)
};

export function getFeedTokens(theme: ThemeName): FeedTokens {
  if (theme === 'comic') {
    const accent = getAppAccent('feed-announcements', 'comic');
    return {
      ...getPluginShellTokens(accent, theme),
      ACCENT_TINT_05: `${accent}0D`,
      ACCENT_TINT_10: `${accent}1A`,
      ACCENT_TINT_20: `${accent}33`,
      ACCENT_TINT_30: `${accent}4D`,
    };
  }
  return {
    ...getPluginShellTokens(FEED_COLOR, theme),
    BG: FEED_BG,
    RAIL: FEED_RAIL_BG,
    HEADER: FEED_SIDEBAR_BG,
    ACCENT_TINT_05: 'rgba(132,204,22,0.05)',
    ACCENT_TINT_10: 'rgba(132,204,22,0.1)',
    ACCENT_TINT_20: 'rgba(132,204,22,0.2)',
    ACCENT_TINT_30: 'rgba(132,204,22,0.3)',
  };
}
