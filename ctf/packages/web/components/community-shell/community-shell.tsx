'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import type { TrustUserExtension } from '../../lib/trust/types';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { HubChannelInfo } from '../../lib/hub/types';
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
  // How much of the Hub this person can use. 'approved_full' is the normal shell.
  // 'support_only' is the limited state for a signed-in member who has not been verified
  // yet: only the general channel (read + post) is shown, with a banner pointing to the
  // Unlock flow. Defaults to 'approved_full'.
  accessTier?: 'approved_full' | 'support_only';
  signInUrl?: string;
};

// The home/general channel slug — the support surface kept open to not-yet-verified members.
const GENERAL_CHANNEL_SLUG = 'general';

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

export function CommunityShell({ initialPlugins, shellStats, currentUser, trust, initialSection = 'chat', isAuthenticated = false, accessTier = 'approved_full', signInUrl = '/sign-in' }: CommunityShellProps) {
  // Support-only members get a limited Hub: just the general channel, no plugin grid.
  const isSupportOnly = accessTier === 'support_only';
  const [section, setSection] = useState<ShellSection>(isSupportOnly ? 'chat' : initialSection);
  const [query, setQuery] = useState('');
  const [plugins, setPlugins] = useState(initialPlugins);
  const [channels, setChannels] = useState<HubChannelInfo[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<PluginSortMode>('recent');
  const [recentPluginSlugs, setRecentPluginSlugs] = useState<string[]>([]);
  const [pluginUsageCounts, setPluginUsageCounts] = useState<Record<string, number>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function loadHubData() {
      try {
        const channelsRes = await fetch('/api/hub/channels', { method: 'GET', cache: 'no-store' });

        if (channelsRes.ok) {
          const channelsPayload = (await channelsRes.json()) as { channels: HubChannelInfo[] };
          if (!cancelled) {
            const allChannels = channelsPayload.channels ?? [];
            // Support-only members may only see the general channel; everyone else sees all.
            const loadedChannels = isSupportOnly
              ? allChannels.filter((channel) => channel.slug === GENERAL_CHANNEL_SLUG)
              : allChannels;
            setChannels(loadedChannels);
            // Default the open channel to the first one (general) so the sidebar
            // shows which channel the chat panel is already displaying.
            setActiveChannel((current) => current ?? loadedChannels[0]?.slug ?? null);
          }
        }
      } catch {
        // Silently fail; channels will remain empty.
      }
    }

    void loadHubData();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isSupportOnly]);

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

  // Support-only members do not get the plugin grid or the plugin tiles in the rails —
  // only the general channel. Hand the shell an empty plugin list in that state so every
  // plugin surface (sidebar tiles, apps grid, right-rail "ready apps") renders empty.
  const shellPlugins = isSupportOnly ? [] : filteredPlugins;

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

  // Channels live inside the chat panel of this single-page shell, so selecting
  // one just keeps the user in the chat section and marks it active — it must not
  // navigate to a separate route (there is no per-channel page; doing so 404s).
  const handleChannelSelect = (slug: string) => {
    setActiveChannel(slug);
    setSection('chat');
    setActiveApp(null);
  };

  const handleSortModeChange = (mode: PluginSortMode) => {
    setSortMode(mode);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PLUGIN_SORT_MODE_STORAGE_KEY, mode);
  };

  const implementedCount = isSupportOnly ? 0 : plugins.filter((p) => p.availabilityState === 'implemented_shell').length;
  const readyApps = isSupportOnly
    ? []
    : orderedPlugins.filter((p) => p.availabilityState === 'implemented_shell').slice(0, 5);

  // Support-only members are pinned to the chat section even if local state drifts.
  const effectiveSection: ShellSection = isSupportOnly ? 'chat' : section;

  return (
    <div className={`${styles.shell} ctf-self-responsive`}>
      <header className={styles.mobileBar}>
        <button
          type="button"
          className={styles.mobileBarMenuBtn}
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
        >
          <Menu size={18} />
        </button>
        <div className={styles.mobileBarBrand}>
          <span className={styles.mobileBarLogo} aria-hidden="true">SH</span>
          <span className={styles.mobileBarTitle}>Survivor Hub</span>
        </div>
        <div className={styles.mobileBarSections} role="tablist" aria-label="Sections">
          <button
            type="button"
            role="tab"
            aria-selected={effectiveSection === 'chat'}
            className={effectiveSection === 'chat' ? `${styles.mobileBarSectionBtn} ${styles.mobileBarSectionBtnActive}` : styles.mobileBarSectionBtn}
            onClick={() => setSection('chat')}
          >
            Chat
          </button>
          {isSupportOnly ? null : (
            <button
              type="button"
              role="tab"
              aria-selected={effectiveSection === 'apps'}
              className={effectiveSection === 'apps' ? `${styles.mobileBarSectionBtn} ${styles.mobileBarSectionBtnActive}` : styles.mobileBarSectionBtn}
              onClick={() => setSection('apps')}
            >
              Apps
            </button>
          )}
        </div>
        <div className={styles.mobileBarAuth}>
          {isAuthenticated ? (
            <span className={styles.mobileBarAvatar} aria-hidden="true">{currentUser.initial}</span>
          ) : (
            <Link className={styles.mobileBarSignIn} href={signInUrl}>Sign in</Link>
          )}
        </div>
      </header>
      <div className={styles.frame}>
        <ShellIconRail section={effectiveSection} onSectionChange={setSection} initial={currentUser.initial} showApps={!isSupportOnly} />
        <ShellSidebar
          section={effectiveSection}
          channels={channels}
          plugins={shellPlugins}
          activeChannel={activeChannel}
          onChannelSelect={handleChannelSelect}
          activeApp={activeApp}
          onAppSelect={handleAppSelect}
          query={query}
          onQueryChange={setQuery}
          mobileOpen={mobileNavOpen}
          onNavigate={() => setMobileNavOpen(false)}
        />
        {mobileNavOpen ? (
          <button
            type="button"
            className={styles.mobileBackdrop}
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
        <main className={`${styles.panel} ${styles.content}`}>
          {loadError ? (
            <section className={styles.usernameAlert} role="alert">{loadError}</section>
          ) : null}
          {isSupportOnly ? (
            <section className={styles.usernameAlert} role="status">
              You have limited access for now. While we verify your profile you can use the general
              channel below to talk to the community and ask for help — for example, finding your
              Quora profile link.{' '}
              <Link className={styles.supportBannerLink} href="/plugin/unlock">
                Share your Quora link to get verified
              </Link>{' '}
              and the rest of the Hub opens up.
            </section>
          ) : null}
          {effectiveSection === 'chat' ? (
            <ShellChatPanel stats={shellStats} plugins={shellPlugins} currentUser={currentUser} isAuthenticated={isAuthenticated} signInUrl={signInUrl} />
          ) : (
            <ShellAppsPanel
              plugins={shellPlugins}
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
