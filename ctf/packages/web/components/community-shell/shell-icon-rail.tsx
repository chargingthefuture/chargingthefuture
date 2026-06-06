'use client';

import Link from 'next/link';
import { MessageSquare, Zap, Bell, Shield } from 'lucide-react';
import type { ShellSection } from './shell-types';
import styles from './community-shell.module.css';

type IconRailProps = {
  section: ShellSection;
  onSectionChange: (s: ShellSection) => void;
  initial?: string;
};

export function ShellIconRail({ section, onSectionChange, initial = 'S' }: IconRailProps) {
  return (
    <aside className={styles.iconRail}>
      <div className={styles.iconRailLogo} aria-hidden="true">SH</div>

      <button
        type="button"
        className={section === 'chat' ? `${styles.iconRailBtn} ${styles.iconRailBtnActive}` : styles.iconRailBtn}
        onClick={() => onSectionChange('chat')}
        aria-label="Chat"
        aria-pressed={section === 'chat'}
      >
        <MessageSquare size={18} />
      </button>

      <button
        type="button"
        className={section === 'apps' ? `${styles.iconRailBtn} ${styles.iconRailBtnActive}` : styles.iconRailBtn}
        onClick={() => onSectionChange('apps')}
        aria-label="Apps"
        aria-pressed={section === 'apps'}
      >
        <Zap size={18} />
      </button>

      <div className={styles.iconRailSpacer} aria-hidden="true" />

      <button
        type="button"
        className={`${styles.iconRailBtn} ${styles.iconRailBtnDisabled}`}
        aria-label="Notifications coming soon"
        aria-disabled="true"
        disabled
        title="Notifications coming soon"
      >
        <Bell size={18} />
      </button>

      <Link
        href="/account/data"
        className={styles.iconRailBtn}
        aria-label="Account and data"
        title="Account & Data — see and delete your data"
      >
        <Shield size={18} />
      </Link>

      <div className={styles.iconRailAvatar} aria-hidden="true">{initial}</div>
    </aside>
  );
}
