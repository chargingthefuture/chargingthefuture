// The screens of the Android app and how they connect. The app has no screen stack: App.tsx holds
// one selected key, the header's back chevron and Android's back button go to `parentOf(key)`, and
// the header names the screen with SCREEN_TITLES.
//
// The native Android app carries the plugins that materially benefit from being an installed app
// (Chyme live audio, Beacon broadcasts, PeerProgramming's live call, Foundation's instant calls), plus
// what they need to run (Clerk auth wall, bug reporting, settings/account); everything else is served
// by the web app. See `.claude/rules/105-web-android-feature-parity-rules.mdc`.

export type FeatureKey =
  | 'apps'
  | 'chyme'
  | 'beacon'
  | 'beacon-admin'
  | 'peer-programming'
  | 'peer-programming-admin'
  | 'foundation'
  | 'account-data'
  | 'blocked-members';

// What each screen's header calls it. Apps has no header title: it carries the top bar instead.
export const SCREEN_TITLES: Record<Exclude<FeatureKey, 'apps'>, string> = {
  chyme: 'Chyme',
  beacon: 'Beacon',
  'beacon-admin': 'Beacon Admin',
  'peer-programming': 'PeerProgramming',
  'peer-programming-admin': 'PeerProgramming Admin',
  foundation: 'Foundation',
  'account-data': 'Account & Data',
  'blocked-members': 'Blocked members',
};

const PLUGIN_KEYS = ['chyme', 'beacon', 'peer-programming', 'foundation'] as const;
export type PluginKey = (typeof PLUGIN_KEYS)[number];

function isPluginKey(key: FeatureKey): key is PluginKey {
  return (PLUGIN_KEYS as readonly string[]).includes(key);
}

// The admin screens, each with the plugin it belongs to. Only an admin may be on one.
const ADMIN_PLUGINS: Partial<Record<FeatureKey, PluginKey>> = {
  'beacon-admin': 'beacon',
  'peer-programming-admin': 'peer-programming',
};

export function isAdminKey(key: FeatureKey): boolean {
  return ADMIN_PLUGINS[key] !== undefined;
}

// The plugin a screen belongs to, for its header icon, accent and bug reports. An admin screen
// belongs to its plugin.
export function pluginOf(key: FeatureKey): PluginKey | undefined {
  return ADMIN_PLUGINS[key] ?? (isPluginKey(key) ? key : undefined);
}

// Where back goes from each screen. Beacon Admin and PeerProgramming Admin go to Apps too: the web
// swaps the member and admin pages in place, so back never bounces between them.
const PARENTS: Partial<Record<FeatureKey, FeatureKey>> = {
  'blocked-members': 'account-data',
};

export function parentOf(key: FeatureKey): FeatureKey {
  return PARENTS[key] ?? 'apps';
}
