// Theme-aware chrome tokens for the Trust plugin surfaces (public shell + embedded widget).
//
// Default theme returns the exact shipped values (accent stays #0EA5E9) so the default UI is
// pixel-identical; comic uses the shared comic surface tokens plus the Trust comic-ink accent.
// Sourced from getPluginShellTokens + getAppAccent so every Trust component paints identical
// chrome and both themes resolve correctly.
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const TRUST_ACCENT = '#0EA5E9';

export type TrustTokens = PluginShellTokens;

export function getTrustTokens(theme: ThemeName): TrustTokens {
  const accent = theme === 'comic' ? getAppAccent('trust', 'comic') : TRUST_ACCENT;
  return getPluginShellTokens(accent, theme);
}
