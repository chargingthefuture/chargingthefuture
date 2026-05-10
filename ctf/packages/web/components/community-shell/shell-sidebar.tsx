'use client';

import Link from 'next/link';
import type { ShellSection } from './shell-types';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import { getPluginVisuals } from './shell-plugin-config';
import styles from './community-shell.module.css';

type ShellSidebarProps = {
  section: ShellSection;
  plugins: PluginRegistryItem[];
  activeApp: string | null;
  onAppSelect: (slug: string | null) => void;
  query: string;
  onQueryChange: (q: string) => void;
};

const STATIC_CHANNELS = [
  { name: 'community-support', href: '/apps/chyme' },
];

const STATIC_DMS = [
  { name: 'Maria G.', status: 'Soon' },
  { name: 'James T.', status: 'Soon' },
  { name: 'Amara O.', status: 'Soon' },
];

export function ShellSidebar({
  section,
  plugins,
  activeApp,
  onAppSelect,
  query,
  onQueryChange,
}: ShellSidebarProps) {
  return (
    <aside className={`${styles.panel} ${styles.leftNav}`}>
      <div className={styles.sidebarHeader}>
        <p className={styles.sectionTitle}>{section === 'chat' ? 'Channel' : 'Mini-Apps'}</p>
        {section === 'apps' ? (
          <>
            <label className={styles.visuallyHidden} htmlFor="sidebar-search">Search apps…</label>
            <input
              id="sidebar-search"
              className={styles.sidebarSearch}
              placeholder="Search apps…"
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </>
        ) : null}
      </div>

      <div className={styles.sidebarBody}>
        {section === 'chat' ? (
          <>
            {STATIC_CHANNELS.map((ch) => (
              <Link key={ch.name} href={ch.href} className={styles.sidebarChannel}>
                <span className={styles.sidebarChannelHash}>#</span>
                <span className={styles.sidebarChannelName}>{ch.name}</span>
              </Link>
            ))}
            <p className={styles.sidebarGroupLabel}>Direct Messages</p>
            {STATIC_DMS.map((dm) => (
              <div
                key={dm.name}
                className={`${styles.sidebarDm} ${styles.sidebarDmDisabled}`}
                aria-disabled="true"
                title="Direct messages are coming in Phase 1"
              >
                <span className={styles.sidebarDmDot} aria-hidden="true" />
                <span className={styles.sidebarDmName}>{dm.name}</span>
                <span className={`${styles.sidebarBadge} ${styles.sidebarBadgeMuted}`}>{dm.status}</span>
              </div>
            ))}
          </>
        ) : (
          plugins.map((plugin) => {
            const { emoji, color } = getPluginVisuals(plugin.slug);
            const isActive = activeApp === plugin.slug;
            return (
              <button
                key={plugin.slug}
                type="button"
                className={isActive ? `${styles.sidebarApp} ${styles.sidebarAppActive}` : styles.sidebarApp}
                style={isActive ? { borderLeftColor: color, color } : undefined}
                onClick={() => onAppSelect(isActive ? null : plugin.slug)}
              >
                <span aria-hidden="true">{emoji}</span>
                <span className={styles.sidebarAppName}>{plugin.name}</span>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.sidebarFooter}>
        <p className={styles.sidebarFooterTitle}>Safe Space · Invite Only</p>
        <p className={styles.sidebarFooterMeta}>4.9M survivors worldwide</p>
      </div>
    </aside>
  );
}
