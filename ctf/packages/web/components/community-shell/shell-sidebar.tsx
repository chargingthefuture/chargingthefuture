'use client';

import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { HubChannelInfo } from '../../lib/hub/types';
import styles from './community-shell.module.css';

type ShellSidebarProps = {
  channels: HubChannelInfo[];
  activeChannel: string | null;
  onChannelSelect: (slug: string) => void;
  // On phones the sidebar is a slide-in drawer; `mobileOpen` controls whether it
  // is shown and `onNavigate` lets it close itself once a destination is picked.
  mobileOpen?: boolean;
  onNavigate?: () => void;
  // Admins get an Admin link in the drawer footer. The desktop icon rail has its own
  // Admin entry, but that rail is hidden on phones, so this is how admins reach /admin there.
  isAdmin?: boolean;
};

// The sidebar is the chat-channel navigation only. Apps are browsed in the main "Apps"
// grid (ShellAppsPanel), so the sidebar deliberately does not list them — having the same
// app list in both the grid and the drawer was redundant.
export function ShellSidebar({
  channels,
  activeChannel,
  onChannelSelect,
  mobileOpen = false,
  onNavigate,
  isAdmin = false,
}: ShellSidebarProps) {
  return (
    <aside className={`${styles.panel} ${styles.leftNav}${mobileOpen ? ` ${styles.leftNavMobileOpen}` : ''}`}>
      <div className={styles.sidebarHeader}>
        <p className={styles.sectionTitle}>Channels</p>
      </div>

      <div className={styles.sidebarBody}>
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
