'use client';

import Link from 'next/link';
import type { PluginAvailabilityState, PluginRegistryItem } from '../../lib/plugins/repository';
import type { PluginSortMode } from './shell-types';
import { getPluginVisuals } from './shell-plugin-config';
import { useTheme } from '@/hooks/useTheme';
import styles from './community-shell.module.css';

function getPluginHref(slug: string): string {
  return `/apps/${encodeURIComponent(slug)}`;
}

// Show a badge only when a plugin is NOT yet fully available, so the badge carries
// information. A fully-shipped plugin (implemented_shell) gets no badge — labeling
// every card "Live" is noise when nearly everything is live.
const PLUGIN_BADGE_LABEL: Partial<Record<PluginAvailabilityState, string>> = {
  planned: 'Coming soon',
  alpha: 'Alpha',
  beta: 'Beta',
};

type ShellAppsPanelProps = {
  plugins: PluginRegistryItem[];
  activeApp: string | null;
  onAppSelect: (slug: string | null) => void;
  // Called when the member actually opens a plugin (the "Open plugin →" link), as opposed to
  // tapping the card to highlight it. This is the event the Recent and Most Used orderings are
  // counted from, so it has to fire on the link — the card tap alone is not a use.
  onAppOpen: (slug: string) => void;
  sortMode: PluginSortMode;
  onSortModeChange: (mode: PluginSortMode) => void;
  // Search now lives here (it used to be in the nav drawer). The grid is the single
  // place to browse apps, so the filter box belongs alongside it.
  query: string;
  onQueryChange: (q: string) => void;
};

export function ShellAppsPanel({ plugins, activeApp, onAppSelect, onAppOpen, sortMode, onSortModeChange, query, onQueryChange }: ShellAppsPanelProps) {
  const { theme } = useTheme();

  return (
    <div className={styles.appsPanel}>
      <div className={styles.appsPanelHeader}>
        <div>
          <h2 className={styles.appsPanelTitle}>All Apps</h2>
          <p className={styles.appsPanelSub}>Your complete peer-to-peer marketplace — from survivor to thriver</p>
        </div>
        <div className={styles.appsSortWrap}>
          <label className={styles.appsSortLabel} htmlFor="apps-sort-mode">Sort</label>
          <select
            id="apps-sort-mode"
            className={styles.appsSortSelect}
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as PluginSortMode)}
          >
            <option value="recent">Recent</option>
            <option value="alpha">A-Z</option>
            <option value="most-used">Most Used</option>
          </select>
        </div>
      </div>

      <label className={styles.visuallyHidden} htmlFor="apps-search">Search apps…</label>
      <input
        id="apps-search"
        className={styles.appsSearchInput}
        placeholder="Search apps…"
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />

      {plugins.length === 0 && (
        <p className={styles.appsEmpty}>No matching plugins. Try a different search.</p>
      )}

      <div className={styles.appsGrid}>
        {plugins.map((plugin) => {
          const { emoji, color, bg } = getPluginVisuals(plugin.slug, theme);
          const isActive = activeApp === plugin.slug;
          const pluginHref = getPluginHref(plugin.slug);
          return (
            <div
              key={plugin.slug}
              className={styles.appCard}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              style={{
                background: isActive ? `${bg}ee` : `${bg}88`,
                borderColor: isActive ? `${color}60` : `${color}20`,
              }}
              onClick={() => onAppSelect(isActive ? null : plugin.slug)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAppSelect(isActive ? null : plugin.slug); } }}
            >
              <div className={styles.appCardTop}>
                <div
                  className={styles.appCardIcon}
                  style={{ background: `${color}20`, borderColor: `${color}35`, color }}
                  aria-hidden="true"
                >
                  {emoji}
                </div>
                <div className={styles.appCardBadges}>
                  {PLUGIN_BADGE_LABEL[plugin.availabilityState] && (
                    <span className={styles.appCardLive} style={{ color }}>
                      {PLUGIN_BADGE_LABEL[plugin.availabilityState]}
                    </span>
                  )}
                </div>
              </div>
              <p className={styles.appCardName}>{plugin.name}</p>
              <p className={styles.appCardDesc}>{plugin.summary}</p>
              <Link
                href={pluginHref}
                className={styles.appCardAction}
                style={{ color, borderColor: `${color}35`, background: `${color}15` }}
                onClick={(e) => {
                  // Stop the card's own click handler from also toggling the highlight, but still
                  // record the open so Recent and Most Used have something to order by.
                  e.stopPropagation();
                  onAppOpen(plugin.slug);
                }}
              >
                Open plugin →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
