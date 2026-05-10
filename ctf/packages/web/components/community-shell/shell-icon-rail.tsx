'use client';

import { MessageSquare, Zap, Bell, Settings } from 'lucide-react';
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

      <button
        type="button"
        className={`${styles.iconRailBtn} ${styles.iconRailBtnDisabled}`}
        aria-label="Settings coming soon"
        aria-disabled="true"
        disabled
        title="Settings are coming soon"
      >
        <Settings size={18} />
      </button>

      <div className={styles.iconRailAvatar} aria-hidden="true">{initial}</div>
    </aside>
  );
}
