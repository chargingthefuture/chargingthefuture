// Chrome tokens for the census admin surfaces. Slate, matching the deletion survey: the two are
// halves of one research program and should not look like unrelated screens.

import { type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const CENSUS_ACCENT = '#94A3B8';
export const CENSUS_ACCENT_COMIC = '#7A6A50';

export type CensusTokens = PluginShellTokens;

export function getCensusTokens(theme: ThemeName): CensusTokens {
  return getPluginShellTokens(theme === 'comic' ? CENSUS_ACCENT_COMIC : CENSUS_ACCENT, theme);
}
