// Theme-aware chrome tokens for the Workforce plugin (shell + all child components).
//
// Default theme returns the exact shipped values (accent stays #F97316) so the default UI is
// pixel-identical; comic uses the shared comic surface tokens plus the Workforce comic-ink accent.
// Sourced from getPluginShellTokens + getAppAccent so every Workforce component paints identical
// chrome and both themes resolve correctly.
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const WORKFORCE_ACCENT = '#F97316';

export type WorkforceTokens = PluginShellTokens;

export function getWorkforceTokens(theme: ThemeName): WorkforceTokens {
  const accent = theme === 'comic' ? getAppAccent('workforce', 'comic') : WORKFORCE_ACCENT;
  return getPluginShellTokens(accent, theme);
}
