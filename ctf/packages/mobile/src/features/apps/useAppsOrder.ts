// The Apps home's sort, copied from the web community shell (components/community-shell/
// community-shell.tsx: sortPluginsForUi and the three stored lists). All three orders run on this
// phone's own record, as they do on the web from the browser's: Recent puts the apps opened most
// lately first, Most Used the ones opened most often, and both fall back to A-Z for apps never opened.
// Only a tap on "Open plugin →" counts as a use; tapping the card just highlights it.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export type AppSortMode = 'recent' | 'alpha' | 'most-used';

// The web's localStorage keys, so the two read alike.
const RECENT_KEY = 'ctf.communityShell.recentPluginSlugs';
const SORT_MODE_KEY = 'ctf.communityShell.pluginSortMode';
const USAGE_COUNTS_KEY = 'ctf.communityShell.pluginUsageCounts';
const MAX_RECENT = 12;

function parseRecent(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function parseSortMode(value: string | null): AppSortMode {
  if (value === 'recent' || value === 'alpha' || value === 'most-used') return value;
  return 'recent';
}

function parseUsageCounts(value: string | null): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, number> = {};
    for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) result[key] = raw;
    }
    return result;
  } catch {
    return {};
  }
}

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  SecureStore.setItemAsync(key, value).catch(() => {
    // no-trace: storage is unavailable; the order still applies for this session.
  });
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export function sortApps<T extends { key: string; name: string }>(
  items: T[],
  mode: AppSortMode,
  recent: string[],
  counts: Record<string, number>,
): T[] {
  if (mode === 'alpha') return [...items].sort(byName);
  if (mode === 'most-used') {
    return [...items].sort((a, b) => {
      const diff = (counts[b.key] ?? 0) - (counts[a.key] ?? 0);
      return diff !== 0 ? diff : byName(a, b);
    });
  }
  const rank = new Map(recent.map((slug, index) => [slug, index] as const));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.key);
    const rb = rank.get(b.key);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return byName(a, b);
  });
}

type StoredOrder = { recent: string[]; counts: Record<string, number> };

export function useAppsOrder() {
  const [sortMode, setSortModeState] = useState<AppSortMode>('recent');
  const [recent, setRecent] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  // The stored lists, kept outside state so an open recorded before the read finishes waits for
  // it and adds to what was stored instead of writing over it from the empty starting state. The
  // read is not instant on Android (it goes through the keystore), and this screen mounts afresh
  // each time the member comes back to it.
  const stored = useRef<StoredOrder>({ recent: [], counts: {} });
  const loaded = useRef<Promise<void> | null>(null);
  const sortModeChosen = useRef(false);
  const mounted = useRef(true);

  if (loaded.current === null) {
    loaded.current = Promise.all([read(RECENT_KEY), read(SORT_MODE_KEY), read(USAGE_COUNTS_KEY)]).then(
      ([r, m, c]) => {
        stored.current = { recent: parseRecent(r), counts: parseUsageCounts(c) };
        if (!mounted.current) return;
        setRecent(stored.current.recent);
        setCounts(stored.current.counts);
        // A choice made before the read finished is already saved; keep it on screen too.
        if (!sortModeChosen.current) setSortModeState(parseSortMode(m));
      },
    );
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setSortMode = useCallback((mode: AppSortMode) => {
    sortModeChosen.current = true;
    setSortModeState(mode);
    write(SORT_MODE_KEY, mode);
  }, []);

  const recordOpen = useCallback((slug: string) => {
    // Opening an app moves away from this screen, so the write must still happen after unmount.
    void loaded.current?.then(() => {
      const prev = stored.current;
      const nextRecent = [slug, ...prev.recent.filter((item) => item !== slug)].slice(0, MAX_RECENT);
      const nextCounts = { ...prev.counts, [slug]: (prev.counts[slug] ?? 0) + 1 };
      stored.current = { recent: nextRecent, counts: nextCounts };
      write(RECENT_KEY, JSON.stringify(nextRecent));
      write(USAGE_COUNTS_KEY, JSON.stringify(nextCounts));
      if (!mounted.current) return;
      setRecent(nextRecent);
      setCounts(nextCounts);
    });
  }, []);

  return { sortMode, setSortMode, recent, counts, recordOpen };
}
