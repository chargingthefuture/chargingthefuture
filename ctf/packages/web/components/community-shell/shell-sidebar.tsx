'use client';

import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { CommonsChannelInfo } from '../../lib/commons/types';
import type { ShellStats } from './shell-types';
import { formatScaledValue } from './shell-format';
import styles from './community-shell.module.css';

type ShellSidebarProps = {
  channels: CommonsChannelInfo[];
  activeChannel: string | null;
  onChannelSelect: (slug: string) => void;
  // Live shell stats (member count) for the footer, so the count is real instead of hardcoded.
  shellStats?: ShellStats;
  // Admins get an Admin link in the sidebar footer. This rail is desktop-only
  // (hidden on phones); on phones admins reach /admin from the top bar instead.
  isAdmin?: boolean;
};

// A readable label for a channel: prefer the server-provided displayName, falling back to a
// Title-cased version of the slug ("general-announcements" → "General Announcements") so the rail
// never shows a raw database slug.
function channelLabel(channel: CommonsChannelInfo): string {
  // Strip any leading "#" the stored display name may carry (e.g. "#general") — the sidebar row
  // already renders its own "#" prefix, so keeping it here produced a double hash ("# #general").
  const name = channel.displayName?.trim().replace(/^#+\s*/, '');
  if (name) return name;
  return channel.slug
    .split('-')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

// The sidebar is the chat-channel navigation only. Apps are browsed in the main "Apps"
// grid (ShellAppsPanel), so the sidebar deliberately does not list them — having the same
// app list in both the grid and the drawer was redundant. Desktop-only: on phones it is
// hidden entirely (one "general" channel offers no real navigation yet).
export function ShellSidebar({
  channels,
  activeChannel,
  onChannelSelect,
  shellStats,
  isAdmin = false,
}: ShellSidebarProps) {
  const memberCount = shellStats?.memberCount ?? null;
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
              <span className={styles.sidebarChannelName}>{channelLabel(ch)}</span>
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
        {/* Per-member verification exists (admin-reviewed); a community-wide "verified" claim does
            not, so the footer states only the membership model. */}
        <p className={styles.sidebarFooterTitle}>Invite Only</p>
        <p className={styles.sidebarFooterMeta}>
          {memberCount ? `${formatScaledValue(memberCount)} survivors worldwide` : 'Survivors worldwide'}
        </p>
      </div>
    </aside>
  );
}
