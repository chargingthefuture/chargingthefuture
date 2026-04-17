'use client';

import Link from 'next/link';
import type { TrustUserExtension } from '../../lib/trust/types';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { ShellCurrentUser } from './shell-types';
import { getPluginVisuals } from './shell-plugin-config';
import { TrustRightRailCard } from '../shared/trust/TrustRightRailCard';
import styles from './community-shell.module.css';

type ShellRightRailProps = {
  readyApps: PluginRegistryItem[];
  implementedCount: number;
  currentUser: ShellCurrentUser;
  trust: TrustUserExtension;
};

export function ShellRightRail({ readyApps, implementedCount, currentUser, trust }: ShellRightRailProps) {
  const displayName = currentUser.displayName;
  const initial = currentUser.initial;

  return (
    <aside className={`${styles.panel} ${styles.rightRail}`}>
      <section className={styles.profileCard}>
        <div className={styles.profileAvatar} aria-hidden="true">{initial}</div>
        <p className={styles.profileName}>Welcome, {displayName}</p>
        <p className={styles.profileMeta}>{currentUser.username ? `@${currentUser.username}` : 'Member'} · {implementedCount} ready apps</p>
        <span className={styles.profileBadge}>Space ✓</span>
      </section>

      {/* Trust evidence panel below Welcome card */}
      <TrustRightRailCard trust={trust} />

      <section className={styles.quoteCard}>
        <p className={styles.quoteText}>&ldquo;You are not what happened to you. You are what you choose to become.&rdquo;</p>
        <p className={styles.quoteAuthor}>— Carl Jung</p>
      </section>

      <section>
        <p className={styles.sectionTitle}>Ready Apps</p>
        <ul className={styles.memberList}>
          {readyApps.map((plugin) => {
            const { emoji, color } = getPluginVisuals(plugin.slug);
            const pluginHref = `/apps/${plugin.slug}`;
            return (
              <li key={plugin.slug}>
                <Link
                  href={pluginHref}
                  className={styles.memberItem}
                  style={{ borderColor: `${color}20` }}
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span className={styles.memberItemName}>{plugin.name}</span>
                  <span className={styles.memberItemGate} style={{ color }}>Ready</span>
                </Link>
              </li>
            );
          })}
          {readyApps.length === 0 && (
            <li className={styles.memberItem}>No ready apps yet.</li>
          )}
        </ul>
      </section>

    </aside>
  );
}
