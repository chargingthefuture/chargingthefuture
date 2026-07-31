// Theme-aware chrome tokens for the Safety admin surface.
//
// Default theme returns the exact shipped values (accent stays the neutral admin indigo #6366F1,
// rule 131) so the default UI is pixel-identical; comic uses the shared comic surface tokens.
// Safety has no PLUGIN_ACCENTS entry, so getAppAccent falls back to the sanctioned neutral comic
// ink. Report-state colors (open amber, reviewed green, dismissed gray) stay raw in the shell.
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const SAFETY_ACCENT = '#6366F1';

export type SafetyTokens = PluginShellTokens;

export function getSafetyTokens(theme: ThemeName): SafetyTokens {
  const accent = theme === 'comic' ? getAppAccent('safety', 'comic') : SAFETY_ACCENT;
  return getPluginShellTokens(accent, theme);
}
