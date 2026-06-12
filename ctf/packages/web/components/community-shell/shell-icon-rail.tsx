'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { MessageSquare, Zap, Shield, SlidersHorizontal } from 'lucide-react';
import type { ShellSection } from './shell-types';
import { HelpControl } from '../bug-reports/help-control';
import styles from './community-shell.module.css';

type IconRailProps = {
  section: ShellSection;
  onSectionChange: (s: ShellSection) => void;
  initial?: string;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
};

export function ShellIconRail({ section, onSectionChange, initial = 'S', isAuthenticated = false, isAdmin = false }: IconRailProps) {
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

      {/* Admin entry: only rendered for users whose Clerk role is "admin". This is the one
          in-app way to reach the admin directory at /admin; the route itself is still
          server-role-gated, so showing the link to a non-admin would only hit a denial page. */}
      {isAdmin ? (
        <Link
          href="/admin"
          className={styles.iconRailBtn}
          aria-label="Admin"
          title="Admin — manage plugins and review queues"
        >
          <SlidersHorizontal size={18} />
        </Link>
      ) : null}

      <Link
        href="/account/data"
        className={styles.iconRailBtn}
        aria-label="Account and data"
        title="Account & Data — see and delete your data"
      >
        <Shield size={18} />
      </Link>

      {/* Global Help control: opens a small popover with "Report a problem", which
          opens the bug-report modal. Signed-in members only — anonymous users can't
          file a report (the route requires any_authenticated). */}
      {isAuthenticated ? <HelpControl /> : null}

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
