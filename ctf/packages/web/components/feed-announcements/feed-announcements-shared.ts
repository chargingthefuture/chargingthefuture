// Theme-aware chrome tokens for the Feed & Announcements admin surface.
//
// Default theme accent is the Feed & Announcements pale violet #C4B5FD — it matches the plugin's
// launcher card (shell-plugin-config PLUGIN_VISUALS) and its PLUGIN_ACCENTS entry so card, shell,
// and comic variant all agree. Comic uses the shared comic surface tokens plus the comic-ink accent.
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const FEED_ANNOUNCEMENTS_ACCENT = '#C4B5FD';

export type FeedAnnouncementsTokens = PluginShellTokens;

export function getFeedAnnouncementsTokens(theme: ThemeName): FeedAnnouncementsTokens {
  const accent = theme === 'comic' ? getAppAccent('feed-announcements', 'comic') : FEED_ANNOUNCEMENTS_ACCENT;
  return getPluginShellTokens(accent, theme);
}
