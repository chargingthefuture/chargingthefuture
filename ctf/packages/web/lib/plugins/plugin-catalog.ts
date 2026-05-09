export type PluginCatalogKind = 'baseline' | 'plugin';

export type PluginCatalogItem = {
  id: string;
  name: string;
  kind: PluginCatalogKind;
  summary: string;
};

export const pluginCatalog: PluginCatalogItem[] = [
  {
    id: 'bf-01-identity-foundation',
    name: 'Identity Foundation',
    kind: 'baseline',
    summary: 'Provider-neutral sign-in baseline and server-side authz guardrails for web.',
  },
  {
    id: 'bf-02-railway-baseline',
    name: 'Railway Baseline',
    kind: 'baseline',
    summary: 'Canonical runtime/deployment baseline for full-stack CTF surfaces.',
  },
  {
    id: 'bf-04-expo-baseline',
    name: 'Expo Baseline',
    kind: 'baseline',
    summary: 'Android deployment baseline for Expo/EAS preview and production readiness.',
  },
  {
    id: 'chyme',
    name: 'Chyme',
    kind: 'plugin',
    summary: 'Room bootstrap, chat, join flow, and deletion behavior with policy/audit.',
  },
  {
    id: 'skills-taxonomy',
    name: 'Skills Taxonomy',
    kind: 'plugin',
    summary: 'Hierarchy and CRUD for sectors, job titles, and skills with impact preview.',
  },
  {
    id: 'directory',
    name: 'Directory',
    kind: 'plugin',
    summary: 'Unified user/admin profile surface with claimed/unclaimed policy controls.',
  },
  {
    id: 'feed-announcements',
    name: 'Feed + Announcements',
    kind: 'plugin',
    summary: 'Timeline and announcement lifecycle in a coupled admin surface.',
  },
  {
    id: 'workforce',
    name: 'Workforce',
    kind: 'plugin',
    summary: 'Dashboard reporting and recruited-state derivation from upstream data.',
  },
  {
    id: 'skills-hunt',
    name: 'Skills Hunt',
    kind: 'plugin',
    summary: 'Rounds, moderation, scoring, leaderboards, and governed profile generation.',
  },
  {
    id: 'unlock',
    name: 'Unlock',
    kind: 'plugin',
    summary: 'Verification queue and staged unlock orchestration tied to support-only safeguards.',
  },
  {
    id: 'foundation',
    name: 'Foundation',
    kind: 'plugin',
    summary: 'Provider search and quote lifecycle using read-only Directory projections.',
  },
  {
    id: 'lighthouse',
    name: 'LightHouse',
    kind: 'plugin',
    summary: 'Profile/property/match parity scope with blocks lifecycle controls.',
  },
  {
    id: 'socketrelay',
    name: 'SocketRelay',
    kind: 'plugin',
    summary: 'Request and fulfillment flows with privacy-minimized public projections.',
  },
  {
    id: 'trusttransport',
    name: 'TrustTransport',
    kind: 'plugin',
    summary: 'Ride/package/food fulfillment with safety-first and dispute controls.',
  },
  {
    id: 'peer-programming',
    name: 'Peer Programming',
    kind: 'plugin',
    summary: 'Weekly cohort assignments with deterministic fallback-open behavior.',
  },
  {
    id: 'mood',
    name: 'Mood',
    kind: 'plugin',
    summary: 'Mood submissions with 7-day cooldown and anonymous clientId persistence.',
  },
  {
    id: 'gentlepulse',
    name: 'GentlePulse',
    kind: 'plugin',
    summary: 'Library listing/playback, ratings, favorites, and support route behavior.',
  },
  {
    id: 'weekly-performance',
    name: 'Weekly Performance',
    kind: 'plugin',
    summary: 'Week selection/guardrails with metrics, comparisons, and export gate checks.',
  },
  {
    id: 'gdp',
    name: 'GDP',
    kind: 'plugin',
    summary: 'Aggregate transparency and admin publish flows with compliance controls.',
  },
  {
    id: 'service-credits',
    name: 'Service Credits',
    kind: 'plugin',
    summary: 'Wallet/transfers/escrow/disputes and treasury governance workflows.',
  },
  {
    id: 'levelup',
    name: 'LevelUp',
    kind: 'plugin',
    summary: 'Flexible training cohorts with milestone escrow release, trainer payouts, stipends, and disputes.',
  },
  {
    id: 'clicklog',
    name: 'ClickLog',
    kind: 'plugin',
    summary: 'Incident counter and logging with optional location/notes, for user event tracking and history.',
  },
];

export const baselinePluginCount = pluginCatalog.filter((plugin) => plugin.kind === 'baseline').length;
export const nonBaselinePlugins = pluginCatalog.filter((plugin) => plugin.kind !== 'baseline');
