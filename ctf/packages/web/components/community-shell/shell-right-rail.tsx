'use client';

import Link from 'next/link';
import type { TrustUserExtension } from '../../lib/trust/types';
import type { ShellCurrentUser } from './shell-types';
import { TrustRightRailCard } from '../shared/trust/TrustRightRailCard';
import styles from './community-shell.module.css';

type ShellRightRailProps = {
  currentUser: ShellCurrentUser;
  trust: TrustUserExtension;
  isAuthenticated?: boolean;
  signInUrl?: string;
};

export function ShellRightRail({ currentUser, trust, isAuthenticated = false, signInUrl = '/sign-in' }: ShellRightRailProps) {
  const initial = currentUser.initial;

  if (!isAuthenticated) {
    return (
      <aside className={`${styles.panel} ${styles.rightRail}`}>
        <section className={styles.profileCard}>
          <div className={styles.profileAvatar} aria-hidden="true">{initial}</div>
          <p className={styles.profileName}>Welcome to Survivor Hub</p>
          <p className={styles.profileMeta}>Sign in to access full features and connect with your community</p>
          <Link href={signInUrl} className={styles.profileLoginBtn}>Sign In</Link>
        </section>

        <section className={styles.quoteCard}>
          <p className={styles.quoteText}>&ldquo;You are not what happened to you. You are what you choose to become.&rdquo;</p>
          <p className={styles.quoteAuthor}>— Carl Jung</p>
        </section>

        <section>
          <p className={styles.rightRailSectionTitle}>About Survivor Hub</p>
          <p className={styles.sectionDesc}>Not sure where to start? Just say what you need in the chat — housing, work, safety, or someone to talk to — and we&apos;ll point you to the right place.</p>
        </section>
      </aside>
    );
  }

  return (
    <aside className={`${styles.panel} ${styles.rightRail}`}>
      <section className={styles.profileCard}>
        <div className={styles.profileAvatar} aria-hidden="true">{initial}</div>
        {/* The greeting deliberately carries no handle: displayName is already "@username", so
            "Welcome, @username" plus the @username meta line below repeated the handle twice. */}
        <p className={styles.profileName}>Welcome back</p>
        <p className={styles.profileMeta}>{currentUser.username ? `@${currentUser.username}` : 'Member'}</p>
        {/* Per-member claim only: the badge states this member passed admin-reviewed verification.
            Members who are not (yet) verified get no badge — there is no community-wide
            verification to fall back on. */}
        {trust.trustStatus === 'verified' ? (
          <span className={styles.profileBadge}>Verified member ✓</span>
        ) : null}
      </section>

      {/* Trust evidence panel below Welcome card */}
      <TrustRightRailCard trust={trust} />

      <section className={styles.quoteCard}>
        <p className={styles.quoteText}>&ldquo;You are not what happened to you. You are what you choose to become.&rdquo;</p>
        <p className={styles.quoteAuthor}>— Carl Jung</p>
      </section>
    </aside>
  );
}
