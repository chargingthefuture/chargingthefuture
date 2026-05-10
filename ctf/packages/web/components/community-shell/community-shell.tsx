'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TrustUserExtension } from '../../lib/trust/types';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { PluginSortMode, ShellCurrentUser, ShellSection, ShellStats } from './shell-types';
import { ShellIconRail } from './shell-icon-rail';
import { ShellSidebar } from './shell-sidebar';
import { ShellChatPanel } from './shell-chat-panel';
import { ShellAppsPanel } from './shell-apps-panel';
import { ShellRightRail } from './shell-right-rail';
import styles from './community-shell.module.css';

type CommunityShellProps = {
  initialPlugins: PluginRegistryItem[];
  shellStats: ShellStats;
  currentUser: ShellCurrentUser;
  trust: TrustUserExtension;
  initialSection?: ShellSection;
  isAuthenticated?: boolean;
  signInUrl?: string;
};

type PluginsApiPayload = {
  plugins?: PluginRegistryItem[];
};

const RECENT_PLUGIN_STORAGE_KEY = 'ctf.communityShell.recentPluginSlugs';
const PLUGIN_SORT_MODE_STORAGE_KEY = 'ctf.communityShell.pluginSortMode';
const PLUGIN_USAGE_COUNTS_STORAGE_KEY = 'ctf.communityShell.pluginUsageCounts';
const MAX_RECENT_PLUGINS = 12;

function parseStoredRecentPlugins(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function parseStoredSortMode(value: string | null): PluginSortMode {
  if (value === 'recent' || value === 'alpha' || value === 'most-used') return value;
  return 'recent';
}

function parseStoredUsageCounts(value: string | null): Record<string, number> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const result: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0) {
        result[key] = rawValue;
      }
    }

    return result;
  } catch {
    return {};
  }
}

function sortPluginsForUi(
  items: PluginRegistryItem[],
  sortMode: PluginSortMode,
  recentSlugs: string[],
  usageCounts: Record<string, number>,
): PluginRegistryItem[] {
  if (sortMode === 'alpha') {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  if (sortMode === 'most-used') {
    return [...items].sort((a, b) => {
      const countA = usageCounts[a.slug] ?? 0;
      const countB = usageCounts[b.slug] ?? 0;

      if (countA !== countB) return countB - countA;

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  const rankBySlug = new Map<string, number>();
  for (let index = 0; index < recentSlugs.length; index += 1) {
    rankBySlug.set(recentSlugs[index], index);
  }

  return [...items].sort((a, b) => {
    const aRecentRank = rankBySlug.get(a.slug);
    const bRecentRank = rankBySlug.get(b.slug);

    if (aRecentRank !== undefined && bRecentRank !== undefined) {
      return aRecentRank - bRecentRank;
    }

    if (aRecentRank !== undefined) return -1;
    if (bRecentRank !== undefined) return 1;

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function CommunityShell({ initialPlugins, shellStats, currentUser, trust, initialSection = 'chat', isAuthenticated = false, signInUrl = '/sign-in' }: CommunityShellProps) {
  const [section, setSection] = useState<ShellSection>(initialSection);
  const [query, setQuery] = useState('');
  const [plugins, setPlugins] = useState(initialPlugins);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<PluginSortMode>('recent');
  const [recentPluginSlugs, setRecentPluginSlugs] = useState<string[]>([]);
  const [pluginUsageCounts, setPluginUsageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setRecentPluginSlugs(parseStoredRecentPlugins(window.localStorage.getItem(RECENT_PLUGIN_STORAGE_KEY)));
    setSortMode(parseStoredSortMode(window.localStorage.getItem(PLUGIN_SORT_MODE_STORAGE_KEY)));
    setPluginUsageCounts(parseStoredUsageCounts(window.localStorage.getItem(PLUGIN_USAGE_COUNTS_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlugins() {
      try {
        const res = await fetch('/api/plugins', { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('Unable to load plugin registry.');
        const payload = (await res.json()) as PluginsApiPayload;
        if (!Array.isArray(payload.plugins)) throw new Error('Invalid plugin registry payload.');
        if (!cancelled) {
          setPlugins(payload.plugins);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) {
          setLoadError('Live plugin data is temporarily unavailable. Showing last known registry snapshot.');
        }
      }
    }

    void loadPlugins();
    return () => {
      cancelled = true;
    };
  }, []);

  const orderedPlugins = useMemo(
    () => sortPluginsForUi(plugins, sortMode, recentPluginSlugs, pluginUsageCounts),
    [plugins, sortMode, recentPluginSlugs, pluginUsageCounts],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlugins = useMemo(() => {
    if (!normalizedQuery) return orderedPlugins;
    return orderedPlugins.filter((p) =>
      `${p.name} ${p.summary}`.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, orderedPlugins]);

  const handleAppSelect = (slug: string | null) => {
    setActiveApp(slug);
    if (!slug || typeof window === 'undefined') return;

    setRecentPluginSlugs((previous) => {
      const next = [slug, ...previous.filter((item) => item !== slug)].slice(0, MAX_RECENT_PLUGINS);
      window.localStorage.setItem(RECENT_PLUGIN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    setPluginUsageCounts((previous) => {
      const next = { ...previous, [slug]: (previous[slug] ?? 0) + 1 };
      window.localStorage.setItem(PLUGIN_USAGE_COUNTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleSortModeChange = (mode: PluginSortMode) => {
    setSortMode(mode);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PLUGIN_SORT_MODE_STORAGE_KEY, mode);
  };

  const implementedCount = plugins.filter((p) => p.availabilityState === 'implemented_shell').length;
  const readyApps = orderedPlugins
    .filter((p) => p.availabilityState === 'implemented_shell')
    .slice(0, 5);

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <ShellIconRail section={section} onSectionChange={setSection} />
        <ShellSidebar
          section={section}
          plugins={filteredPlugins}
          activeApp={activeApp}
          onAppSelect={handleAppSelect}
          query={query}
          onQueryChange={setQuery}
        />
        <main className={`${styles.panel} ${styles.content}`}>
          {loadError ? (
            <section className={styles.usernameAlert} role="alert">{loadError}</section>
          ) : null}
          {section === 'chat' ? (
            <ShellChatPanel stats={shellStats} plugins={filteredPlugins} currentUser={currentUser} isAuthenticated={isAuthenticated} signInUrl={signInUrl} />
          ) : (
            <ShellAppsPanel
              plugins={filteredPlugins}
              activeApp={activeApp}
              onAppSelect={handleAppSelect}
              sortMode={sortMode}
              onSortModeChange={handleSortModeChange}
            />
          )}
        </main>
        <ShellRightRail
          readyApps={readyApps}
          implementedCount={implementedCount}
          currentUser={currentUser}
          trust={trust}
          isAuthenticated={isAuthenticated}
          signInUrl={signInUrl}
        />
      </div>
    </div>
  );
}
