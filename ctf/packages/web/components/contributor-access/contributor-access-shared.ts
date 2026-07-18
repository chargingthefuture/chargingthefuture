// Theme-aware chrome tokens for the Contributor Access admin surface.
//
// Contributor Access is cross-cutting platform gating with no plugin accent, so it uses the
// neutral admin indigo (rule 131) — same posture as Bug Reports; comic uses the shared comic
// surface tokens.
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const CONTRIBUTOR_ACCESS_ACCENT = '#6366F1';

export type ContributorAccessTokens = PluginShellTokens;

export function getContributorAccessTokens(theme: ThemeName): ContributorAccessTokens {
  const accent = theme === 'comic' ? getAppAccent('contributor-access', 'comic') : CONTRIBUTOR_ACCESS_ACCENT;
  return getPluginShellTokens(accent, theme);
}
