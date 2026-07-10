// Theme-aware chrome tokens for the Feed & Announcements admin surface.
//
// Default theme returns the exact shipped values (accent stays the official announcements purple
// #7C3AED) so the default UI is pixel-identical; comic uses the shared comic surface tokens.
// Feed & Announcements has no PLUGIN_ACCENTS entry, so getAppAccent falls back to the sanctioned
// neutral comic ink.
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const FEED_ANNOUNCEMENTS_ACCENT = '#7C3AED';

export type FeedAnnouncementsTokens = PluginShellTokens;

export function getFeedAnnouncementsTokens(theme: ThemeName): FeedAnnouncementsTokens {
  const accent = theme === 'comic' ? getAppAccent('feed-announcements', 'comic') : FEED_ANNOUNCEMENTS_ACCENT;
  return getPluginShellTokens(accent, theme);
}
