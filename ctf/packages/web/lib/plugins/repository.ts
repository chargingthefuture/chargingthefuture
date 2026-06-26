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

// Operator-only surfaces: real plugins that should not appear in the user app launcher and
// whose /apps/<slug> route is gated to admins. Admins still see and use them; everyone else
// neither sees the tile nor can open the route. Kept in code (not the DB registry) so it holds
// whether the registry is served from the database or the in-code fallback.
export const ADMIN_ONLY_PLUGIN_SLUGS = new Set<string>(['weekly-performance']);

export function isAdminOnlyPlugin(slug: string): boolean {
  return ADMIN_ONLY_PLUGIN_SLUGS.has(slug);
}

// Drop operator-only plugins for non-admin viewers; admins see the full list.
export function filterPluginsForViewer<T extends { slug: string }>(plugins: T[], isAdmin: boolean): T[] {
  return isAdmin ? plugins : plugins.filter((plugin) => !ADMIN_ONLY_PLUGIN_SLUGS.has(plugin.slug));
}

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
    summary: 'Live social audio rooms. Broadcast, listen, and connect in real time.',
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
    summary: 'Browse skills across the survivor community.',
    availabilityState: 'implemented_shell',
    navRank: 30,
    isVisible: true,
  },
  {
    slug: 'workforce',
    name: 'Workforce',
    summary: 'Real-time work and skills distribution amongst 5 million survivors globally.',
    availabilityState: 'implemented_shell',
    navRank: 50,
    isVisible: true,
  },
  {
    slug: 'skills-hunt',
    name: 'SkillsHunt',
    summary: 'Discover skills across the network.',
    availabilityState: 'implemented_shell',
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
    summary: 'Find talent, tools, repairs, and infrastructure support in real time.',
    availabilityState: 'implemented_shell',
    navRank: 70,
    isVisible: true,
  },
  {
    slug: 'lighthouse',
    name: 'LightHouse',
    summary: 'Verified survivor housing listings.',
    availabilityState: 'implemented_shell',
    navRank: 80,
    isVisible: true,
  },
  {
    slug: 'socket-relay',
    name: 'SocketRelay',
    summary: 'Real-time resource sharing across the network.',
    availabilityState: 'implemented_shell',
    navRank: 90,
    isVisible: true,
  },
  {
    slug: 'trust-transport',
    name: 'TrustTransport',
    summary: 'Vetted transportation for safe travel. Drivers screened by the community, for the community.',
    availabilityState: 'implemented_shell',
    navRank: 100,
    isVisible: true,
  },
  {
    slug: 'peer-programming',
    name: 'PeerProgramming',
    summary: 'Weekly global mastermind sessions.',
    availabilityState: 'implemented_shell',
    navRank: 110,
    isVisible: true,
  },
  {
    slug: 'mood',
    name: 'Mood',
    summary: 'Anonymous mood tracking and pattern awareness. Know yourself. See patterns. Take back control.',
    availabilityState: 'implemented_shell',
    navRank: 120,
    isVisible: true,
  },
  {
    slug: 'gentlepulse',
    name: 'GentlePulse',
    summary: 'Meditations: gentle, consistent, non-intrusive.',
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
    summary: 'Real time $300B global survivor economic tracker. Your contributions counted, recorded, visible.',
    availabilityState: 'implemented_shell',
    navRank: 150,
    isVisible: true,
  },
  {
    slug: 'service-credits',
    name: 'ServiceCredits',
    summary: 'Alternative economy and credits exchange. Trade value inside the network — no outside systems needed.',
    availabilityState: 'implemented_shell',
    navRank: 160,
    isVisible: true,
  },
  {
    slug: 'level-up',
    name: 'LevelUp',
    summary: 'Paid skills-training cohorts — learn a skill with a trainer and earn stipends as you reach each milestone.',
    availabilityState: 'implemented_shell',
    navRank: 170,
    isVisible: true,
  },
  {
    slug: 'clicklog',
    name: 'ClickLog',
    summary: 'Safety check-in and incident logging — location optional. Log what happened, check in when you\'re safe.',
    availabilityState: 'implemented_shell',
    navRank: 180,
    isVisible: true,
  },
  {
    slug: 'trust',
    name: 'Trust',
    summary: 'Community reputation and verification. Trust signals built through real participation — your credibility, visible and portable.',
    availabilityState: 'implemented_shell',
    navRank: 190,
    isVisible: false,
  },
  {
    slug: 'what-works',
    name: 'WhatWorks',
    summary: 'One shared, survivor-verified list of tools — organized by the exact problems survivors face. No ads, no affiliates.',
    availabilityState: 'implemented_shell',
    navRank: 200,
    isVisible: true,
  },
  {
    slug: 'contributions',
    name: 'Contributions',
    summary: 'Voluntary fundraiser drives — gift-card, Quora-comment, and GitHub-star contributions with service-credit thank-you grants.',
    availabilityState: 'implemented_shell',
    navRank: 210,
    isVisible: true,
  },
  {
    slug: 'bug-reporting',
    name: 'Bug Reporting',
    summary: 'In-app problem reports that flow to a private triage repo; raw text stays private and a human approves any fix.',
    availabilityState: 'implemented_shell',
    navRank: 220,
    isVisible: false,
  },
  {
    slug: 'beacon',
    name: 'Beacon',
    summary: 'Live one-way broadcasts from the team. Watch publicly with just a link; sign in to chat and react.',
    availabilityState: 'implemented_shell',
    navRank: 230,
    isVisible: true,
  },
];

const pluginAliasMap: Record<string, string> = {
  'gross-domestic-product': 'gdp',
  leveluptraining: 'level-up',
  servicecredits: 'service-credits',
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
