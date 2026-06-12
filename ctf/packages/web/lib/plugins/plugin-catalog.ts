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
    summary: 'Live social audio rooms. Broadcast, listen, and connect in real time.',
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
    summary: 'Browse skills across the survivor community.',
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
    summary: 'Real-time work and skills distribution amongst 5 million survivors globally.',
  },
  {
    id: 'skills-hunt',
    name: 'Skills Hunt',
    kind: 'plugin',
    summary: 'Discover skills across the network.',
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
    summary: 'Find talent, tools, repairs, and infrastructure support in real time.',
  },
  {
    id: 'lighthouse',
    name: 'LightHouse',
    kind: 'plugin',
    summary: 'Verified survivor housing listings.',
  },
  {
    id: 'socketrelay',
    name: 'SocketRelay',
    kind: 'plugin',
    summary: 'Real-time resource sharing across the network.',
  },
  {
    id: 'trusttransport',
    name: 'TrustTransport',
    kind: 'plugin',
    summary: 'Vetted transportation for safe travel. Drivers screened by the community, for the community.',
  },
  {
    id: 'peer-programming',
    name: 'Peer Programming',
    kind: 'plugin',
    summary: 'Weekly global mastermind sessions.',
  },
  {
    id: 'mood',
    name: 'Mood',
    kind: 'plugin',
    summary: 'Anonymous mood tracking and pattern awareness. Know yourself. See patterns. Take back control.',
  },
  {
    id: 'gentlepulse',
    name: 'GentlePulse',
    kind: 'plugin',
    summary: 'Meditations: gentle, consistent, non-intrusive.',
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
    summary: 'Real time $300B global survivor economic tracker. Your contributions counted, recorded, visible.',
  },
  {
    id: 'service-credits',
    name: 'Service Credits',
    kind: 'plugin',
    summary: 'Alternative economy and credits exchange. Trade value inside the network — no outside systems needed.',
  },
  {
    id: 'levelup',
    name: 'LevelUp',
    kind: 'plugin',
    summary: 'Goal tracking and progress milestones. Your journey, documented and celebrated.',
  },
  {
    id: 'clicklog',
    name: 'ClickLog',
    kind: 'plugin',
    summary: 'Safety check-in and incident logging — location optional. Log what happened, check in when you\'re safe.',
  },
  {
    id: 'trust',
    name: 'Trust',
    kind: 'plugin',
    summary: 'Community reputation and verification. Trust signals built through real participation — your credibility, visible and portable.',
  },
];

export const baselinePluginCount = pluginCatalog.filter((plugin) => plugin.kind === 'baseline').length;
export const nonBaselinePlugins = pluginCatalog.filter((plugin) => plugin.kind !== 'baseline');
