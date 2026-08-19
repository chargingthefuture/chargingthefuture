// Chrome tokens for the Quora account-deletion survey surfaces.
//
// The accent is defined here rather than in PLUGIN_ACCENTS because this is not a plugin: it is a
// research form with a public page and an admin reader, and it never appears in the member nav.
// Slate rather than a signal color — the page asks someone to give an account of something that
// was done to them, and an alarm-red or warning-amber frame would color the answer before it is
// given.

import { type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const SURVEY_ACCENT = '#94A3B8';
export const SURVEY_ACCENT_COMIC = '#7A6A50';

export type SurveyTokens = PluginShellTokens;

export function getSurveyTokens(theme: ThemeName): SurveyTokens {
  return getPluginShellTokens(theme === 'comic' ? SURVEY_ACCENT_COMIC : SURVEY_ACCENT, theme);
}
