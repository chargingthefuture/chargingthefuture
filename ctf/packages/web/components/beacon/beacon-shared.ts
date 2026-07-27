// Theme-aware chrome tokens for the Beacon plugin (admin shell, host stage, public viewer).
//
// Default theme returns the exact shipped values (accent stays the Beacon red BEACON_COLOR) so
// the default UI is pixel-identical; comic uses the shared comic surface tokens. Beacon has no
// PLUGIN_ACCENTS entry, so getAppAccent falls back to the sanctioned neutral comic ink.
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { BEACON_COLOR } from 'lib/beacon/constants';

export type BeaconTokens = PluginShellTokens;

export function getBeaconTokens(theme: ThemeName): BeaconTokens {
  const accent = theme === 'comic' ? getAppAccent('beacon', 'comic') : BEACON_COLOR;
  return getPluginShellTokens(accent, theme);
}
