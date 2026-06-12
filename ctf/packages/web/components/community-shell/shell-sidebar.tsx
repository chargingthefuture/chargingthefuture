'use client';

import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { ShellSection } from './shell-types';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { HubChannelInfo } from '../../lib/hub/types';
import { getPluginVisuals } from './shell-plugin-config';
import { useTheme } from '@/hooks/useTheme';
import styles from './community-shell.module.css';

type ShellSidebarProps = {
  section: ShellSection;
  channels: HubChannelInfo[];
  plugins: PluginRegistryItem[];
  activeChannel: string | null;
  onChannelSelect: (slug: string) => void;
  activeApp: string | null;
  onAppSelect: (slug: string | null) => void;
  query: string;
  onQueryChange: (q: string) => void;
  // On phones the sidebar is a slide-in drawer; `mobileOpen` controls whether it
  // is shown and `onNavigate` lets it close itself once a destination is picked.
  mobileOpen?: boolean;
  onNavigate?: () => void;
  // Admins get an Admin link in the drawer footer. The desktop icon rail has its own
  // Admin entry, but that rail is hidden on phones, so this is how admins reach /admin there.
  isAdmin?: boolean;
};

export function ShellSidebar({
  section,
  channels,
  plugins,
  activeChannel,
  onChannelSelect,
  activeApp,
  onAppSelect,
  query,
  onQueryChange,
  mobileOpen = false,
  onNavigate,
  isAdmin = false,
}: ShellSidebarProps) {
  const { theme } = useTheme();
  return (
    <aside className={`${styles.panel} ${styles.leftNav}${mobileOpen ? ` ${styles.leftNavMobileOpen}` : ''}`}>
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
            {channels.map((ch) => {
              const isActive = activeChannel === ch.slug;
              return (
                <button
                  key={ch.slug}
                  type="button"
                  className={isActive ? `${styles.sidebarChannel} ${styles.sidebarChannelActive}` : styles.sidebarChannel}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    onChannelSelect(ch.slug);
                    onNavigate?.();
                  }}
                >
                  <span className={styles.sidebarChannelHash}>#</span>
                  <span className={styles.sidebarChannelName}>{ch.slug}</span>
                </button>
              );
            })}
          </>
        ) : (
          plugins.map((plugin) => {
            const { emoji, color } = getPluginVisuals(plugin.slug, theme);
            const isActive = activeApp === plugin.slug;
            return (
              <button
                key={plugin.slug}
                type="button"
                className={isActive ? `${styles.sidebarApp} ${styles.sidebarAppActive}` : styles.sidebarApp}
                style={isActive ? { borderLeftColor: color, color } : undefined}
                onClick={() => {
                  onAppSelect(isActive ? null : plugin.slug);
                  onNavigate?.();
                }}
              >
                <span aria-hidden="true">{emoji}</span>
                <span className={styles.sidebarAppName}>{plugin.name}</span>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.sidebarFooter}>
        {isAdmin ? (
          <Link href="/admin" className={styles.sidebarAdminLink} onClick={() => onNavigate?.()}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Admin</span>
          </Link>
        ) : null}
        <p className={styles.sidebarFooterTitle}>Verified Community · Invite Only</p>
        <p className={styles.sidebarFooterMeta}>4.9M survivors worldwide</p>
      </div>
    </aside>
  );
}
