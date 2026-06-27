'use client';

import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { HubChannelInfo } from '../../lib/hub/types';
import styles from './community-shell.module.css';

type ShellSidebarProps = {
  channels: HubChannelInfo[];
  activeChannel: string | null;
  onChannelSelect: (slug: string) => void;
  // Admins get an Admin link in the sidebar footer. This rail is desktop-only
  // (hidden on phones); on phones admins reach /admin from the top bar instead.
  isAdmin?: boolean;
};

// The sidebar is the chat-channel navigation only. Apps are browsed in the main "Apps"
// grid (ShellAppsPanel), so the sidebar deliberately does not list them — having the same
// app list in both the grid and the drawer was redundant. Desktop-only: on phones it is
// hidden entirely (one "general" channel offers no real navigation yet).
export function ShellSidebar({
  channels,
  activeChannel,
  onChannelSelect,
  isAdmin = false,
}: ShellSidebarProps) {
  return (
    <aside className={`${styles.panel} ${styles.leftNav}`}>
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
              onClick={() => onChannelSelect(ch.slug)}
            >
              <span className={styles.sidebarChannelHash}>#</span>
              <span className={styles.sidebarChannelName}>{ch.slug}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.sidebarFooter}>
        {isAdmin ? (
          <Link href="/admin" className={styles.sidebarAdminLink}>
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
