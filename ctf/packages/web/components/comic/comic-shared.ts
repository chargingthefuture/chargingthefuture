// Theme-aware chrome tokens for the AI Assistant (@comic) review dashboard.
//
// Default theme returns the exact shipped values (accent stays the shipped sky #0EA5E9 used by the
// review dashboard) so the default UI is pixel-identical; comic uses the shared comic surface
// tokens plus the spec accent for the 'comic' slug (inkDim — the AI Assistant deliberately gets no
// blue in comic theme, per PLUGIN_ACCENTS).
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const COMIC_ACCENT = '#0EA5E9';

export type ComicTokens = PluginShellTokens;

export function getComicTokens(theme: ThemeName): ComicTokens {
  const accent = theme === 'comic' ? getAppAccent('comic', 'comic') : COMIC_ACCENT;
  return getPluginShellTokens(accent, theme);
}
