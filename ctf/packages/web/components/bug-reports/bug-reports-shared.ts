// Theme-aware chrome tokens for the Bug Reports admin surface.
//
// Default theme returns the exact shipped values (accent stays the neutral admin indigo #6366F1,
// rule 131) so the default UI is pixel-identical; comic uses the shared comic surface tokens.
// Bug Reports has no PLUGIN_ACCENTS entry, so getAppAccent falls back to the sanctioned neutral
// comic ink.
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const BUG_REPORTS_ACCENT = '#6366F1';

export type BugReportsTokens = PluginShellTokens;

export function getBugReportsTokens(theme: ThemeName): BugReportsTokens {
  const accent = theme === 'comic' ? getAppAccent('bug-reports', 'comic') : BUG_REPORTS_ACCENT;
  return getPluginShellTokens(accent, theme);
}
