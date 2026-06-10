'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { MessageSquare, Zap, Shield } from 'lucide-react';
import type { ShellSection } from './shell-types';
import styles from './community-shell.module.css';

type IconRailProps = {
  section: ShellSection;
  onSectionChange: (s: ShellSection) => void;
  initial?: string;
  isAuthenticated?: boolean;
};

export function ShellIconRail({ section, onSectionChange, initial = 'S', isAuthenticated = false }: IconRailProps) {
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

      <Link
        href="/account/data"
        className={styles.iconRailBtn}
        aria-label="Account and data"
        title="Account & Data — see and delete your data"
      >
        <Shield size={18} />
      </Link>

      {isAuthenticated ? (
        // Clerk's own account widget: clicking the avatar opens Clerk's menu, and
        // "Manage account" opens Clerk's profile UI where the member edits their
        // first name, last name, username, and email. This is the one place in the
        // shell that leads to identity editing, so it must stay a live control.
        <span className={styles.clerkAvatarSlot} title="Your account — edit name, username, and email">
          <UserButton appearance={{ elements: { avatarBox: styles.clerkAvatarBox } }} />
        </span>
      ) : (
        <div className={styles.iconRailAvatar} aria-hidden="true">{initial}</div>
      )}
    </aside>
  );
}
