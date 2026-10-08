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
  | 'account'
  | 'account-data'
  | 'blocked-members'
  | 'unlock'
  | 'recurring-activity';

// The account screens: the gear opens Your account (web /account), and Account & Data, Blocked
// members, Verification (Unlock) and Recurring activity sit under it, as /account/data,
// /account/blocks, /plugin/unlock and /apps/recurring-activity do. All need a signed-in member.
const ACCOUNT_KEYS: readonly FeatureKey[] = ['account', 'account-data', 'blocked-members', 'unlock', 'recurring-activity'];

export function isAccountKey(key: FeatureKey): boolean {
  return ACCOUNT_KEYS.includes(key);
}

// The screens that draw the web's own header instead of the shared one: the account sub-screens
// (back control in the page, as on the web).
type OwnHeaderKey = 'account-data' | 'blocked-members' | 'unlock' | 'recurring-activity';
export type SharedHeaderKey = Exclude<FeatureKey, 'apps' | OwnHeaderKey>;

export function hasSharedHeader(key: FeatureKey): key is SharedHeaderKey {
  return key !== 'apps' && (key === 'account' || !isAccountKey(key));
}

// What each shared header calls its screen. Apps carries the top bar instead.
export const SCREEN_TITLES: Record<SharedHeaderKey, string> = {
  chyme: 'Chyme',
  beacon: 'Beacon',
  'beacon-admin': 'Beacon Admin',
  'peer-programming': 'PeerProgramming',
  'peer-programming-admin': 'PeerProgramming Admin',
  foundation: 'Foundation',
  account: 'Your account',
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
  'account-data': 'account',
  'blocked-members': 'account',
  unlock: 'account',
  'recurring-activity': 'account',
};

export function parentOf(key: FeatureKey): FeatureKey {
  return PARENTS[key] ?? 'apps';
}
