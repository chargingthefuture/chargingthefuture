import { queryDb } from 'lib/db/postgres';

export type PluginAvailabilityState = 'implemented_shell' | 'planned' | 'alpha' | 'beta';

export type PluginRegistryItem = {
  slug: string;
  name: string;
  summary: string;
  availabilityState: PluginAvailabilityState;
  navRank: number;
  isVisible: boolean;
};

export type PluginRegistrySummary = {
  total: number;
  implementedShells: number;
  planned: number;
};

type PluginRegistryRow = {
  plugin_slug: string;
  display_name: string;
  summary: string;
  availability_state: PluginAvailabilityState;
  nav_rank: number;
  is_visible: boolean;
};

const fallbackPluginRegistry: PluginRegistryItem[] = [
  {
    slug: 'chyme',
    name: 'Chyme',
    summary: 'Room bootstrap, chat, join flow, and deletion behavior with policy/audit.',
    availabilityState: 'implemented_shell',
    navRank: 10,
    isVisible: true,
  },
  {
    slug: 'skills-taxonomy',
    name: 'Skills Taxonomy',
    summary: 'Hierarchy and CRUD for sectors, job titles, and skills with impact preview.',
    availabilityState: 'implemented_shell',
    navRank: 20,
    isVisible: true,
  },
  {
    slug: 'directory',
    name: 'Directory',
    summary: 'Unified user/admin profile surface with claimed/unclaimed policy controls.',
    availabilityState: 'implemented_shell',
    navRank: 30,
    isVisible: true,
  },
  {
    slug: 'workforce',
    name: 'Workforce',
    summary: 'Dashboard reporting and recruited-state derivation from upstream data.',
    availabilityState: 'implemented_shell',
    navRank: 50,
    isVisible: true,
  },
  {
    slug: 'skills-hunt',
    name: 'Skills Hunt',
    summary: 'Rounds, moderation, scoring, leaderboards, and governed profile generation.',
    availabilityState: 'alpha',
    navRank: 60,
    isVisible: true,
  },
  {
    slug: 'unlock',
    name: 'Unlock',
    summary: 'Internal verification queue and staged unlock orchestration for Quora URL onboarding.',
    availabilityState: 'implemented_shell',
    navRank: 65,
    isVisible: false,
  },
  {
    slug: 'foundation',
    name: 'Foundation',
    summary: 'Provider search and quote lifecycle using read-only Directory projections.',
    availabilityState: 'implemented_shell',
    navRank: 70,
    isVisible: true,
  },
  {
    slug: 'lighthouse',
    name: 'LightHouse',
    summary: 'Profile/property/match parity scope with blocks lifecycle controls.',
    availabilityState: 'implemented_shell',
    navRank: 80,
    isVisible: true,
  },
  {
    slug: 'socketrelay',
    name: 'SocketRelay',
    summary: 'Request and fulfillment flows with privacy-minimized public projections.',
    availabilityState: 'implemented_shell',
    navRank: 90,
    isVisible: true,
  },
  {
    slug: 'trusttransport',
    name: 'TrustTransport',
    summary: 'Ride/package/food fulfillment with safety-first and dispute controls.',
    availabilityState: 'implemented_shell',
    navRank: 100,
    isVisible: true,
  },
  {
    slug: 'peer-programming',
    name: 'Peer Programming',
    summary: 'Weekly cohort assignments with deterministic fallback-open behavior.',
    availabilityState: 'implemented_shell',
    navRank: 110,
    isVisible: true,
  },
  {
    slug: 'mood',
    name: 'Mood',
    summary: 'Mood submissions with 7-day cooldown and anonymous clientId persistence.',
    availabilityState: 'implemented_shell',
    navRank: 120,
    isVisible: true,
  },
  {
    slug: 'gentlepulse',
    name: 'GentlePulse',
    summary: 'Library listing/playback, ratings, favorites, and support route behavior.',
    availabilityState: 'implemented_shell',
    navRank: 130,
    isVisible: true,
  },
  {
    slug: 'weekly-performance',
    name: 'Weekly Performance',
    summary: 'Week selection/guardrails with metrics, comparisons, and export gate checks.',
    availabilityState: 'implemented_shell',
    navRank: 140,
    isVisible: true,
  },
  {
    slug: 'gdp',
    name: 'GDP',
    summary: 'Aggregate transparency and admin publish flows with compliance controls.',
    availabilityState: 'implemented_shell',
    navRank: 150,
    isVisible: true,
  },
  {
    slug: 'service-credits',
    name: 'Service Credits',
    summary: 'Wallet/transfers/escrow/disputes and treasury governance workflows.',
    availabilityState: 'implemented_shell',
    navRank: 160,
    isVisible: true,
  },
  {
    slug: 'levelup',
    name: 'LevelUp',
    summary: 'Flexible training cohorts with milestone escrow release, trainer payouts, stipends, and disputes.',
    availabilityState: 'implemented_shell',
    navRank: 170,
    isVisible: true,
  },
  {
    slug: 'clicklog',
    name: 'ClickLog',
    summary: 'Incident counter and logging with optional location/notes, for user event tracking and history.',
    availabilityState: 'implemented_shell',
    navRank: 180,
    isVisible: true,
  },
  {
    slug: 'trust',
    name: 'Trust',
    summary: 'Privacy-first verification status and evidence panels embedded into Directory profile surfaces.',
    availabilityState: 'implemented_shell',
    navRank: 190,
    isVisible: false,
  },
  {
    slug: 'whatworks',
    name: 'WhatWorks',
    summary: 'One shared, survivor-verified list of tools that solved a specific problem, with admin-curated problems and reviewed suggestions.',
    availabilityState: 'implemented_shell',
    navRank: 200,
    isVisible: true,
  },
  {
    slug: 'bug-reporting',
    name: 'Bug Reporting',
    summary: 'In-app problem reports that flow to a private triage repo; raw text stays private and a human approves any fix.',
    availabilityState: 'planned',
    navRank: 210,
    isVisible: false,
  },
];

const pluginAliasMap: Record<string, string> = {
  'gross-domestic-product': 'gdp',
  leveluptraining: 'levelup',
  servicecredits: 'service-credits',
  'socket-relay': 'socketrelay',
  'trust-transport': 'trusttransport',
};

export function canonicalizePluginSlug(input: string): string {
  const normalized = input.trim().toLowerCase();
  return pluginAliasMap[normalized] ?? normalized;
}

export function getPluginRoute(slug: string): string {
  return `/apps/${encodeURIComponent(slug)}`;
}

function mapPluginRegistryRow(row: PluginRegistryRow): PluginRegistryItem {
  return {
    slug: row.plugin_slug,
    name: row.display_name,
    summary: row.summary,
    availabilityState: row.availability_state,
    navRank: row.nav_rank,
    isVisible: row.is_visible,
  };
}

function buildSummary(items: PluginRegistryItem[]): PluginRegistrySummary {
  let implementedShells = 0;
  let planned = 0;

  for (const item of items) {
    if (item.availabilityState === 'implemented_shell') {
      implementedShells += 1;
      continue;
    }

    planned += 1;
  }

  return {
    total: items.length,
    implementedShells,
    planned,
  };
}

function sortPluginsByName(items: PluginRegistryItem[]): PluginRegistryItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function listPluginRegistry(options?: { includeHidden?: boolean }): Promise<PluginRegistryItem[]> {
  const includeHidden = Boolean(options?.includeHidden);

  try {
    const result = await queryDb<PluginRegistryRow>(
      `SELECT
         plugin_slug,
         display_name,
         summary,
         availability_state,
         nav_rank,
         is_visible
       FROM ctf_plugin_registry
       WHERE ($1::boolean OR is_visible = TRUE)
       ORDER BY display_name ASC`,
      [includeHidden],
    );

    if (result.rows.length > 0) {
      return result.rows.map(mapPluginRegistryRow);
    }

    const items = includeHidden
      ? fallbackPluginRegistry
      : fallbackPluginRegistry.filter((item) => item.isVisible);

    return sortPluginsByName(items);
  } catch {
    const items = includeHidden
      ? fallbackPluginRegistry
      : fallbackPluginRegistry.filter((item) => item.isVisible);

    return sortPluginsByName(items);
  }
}

export async function getPluginBySlug(slug: string): Promise<PluginRegistryItem | null> {
  const canonicalSlug = canonicalizePluginSlug(slug);

  try {
    const result = await queryDb<PluginRegistryRow>(
      `SELECT
         plugin_slug,
         display_name,
         summary,
         availability_state,
         nav_rank,
         is_visible
       FROM ctf_plugin_registry
       WHERE plugin_slug = $1
       LIMIT 1`,
      [canonicalSlug],
    );

    if (result.rowCount === 0) {
      return fallbackPluginRegistry.find((item) => item.slug === canonicalSlug) ?? null;
    }

    return mapPluginRegistryRow(result.rows[0]);
  } catch {
    return fallbackPluginRegistry.find((item) => item.slug === canonicalSlug) ?? null;
  }
}

export async function listPluginRegistryWithSummary(options?: { includeHidden?: boolean }) {
  const plugins = await listPluginRegistry(options);
  return {
    plugins,
    summary: buildSummary(plugins),
  };
}
