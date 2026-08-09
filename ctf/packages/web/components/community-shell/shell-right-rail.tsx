'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import type { TrustUserExtension } from '../../lib/trust/types';
import type { ShellCurrentUser } from './shell-types';
import { TrustRightRailCard } from '../shared/trust/TrustRightRailCard';
import styles from './community-shell.module.css';

// The avatar photo is drawn by writing the URL into a CSS `url("…")` string, so anything that could
// close that quoted string early would be writing raw CSS into the page. Clerk's own image URLs are
// plain https links and safe, but the value is checked rather than trusted. Parsing it and using the
// parser's own output does the escaping: the URL parser percent-encodes quotes, turns backslashes
// into slashes, and drops control characters, so the result cannot contain a string terminator.
// (Percent-encoding it again here would corrupt any URL that already contains a %-escape.) Only
// http(s) is accepted, and the quote/backslash check below is a cheap backstop. Returns null when
// there is no usable photo, which falls back to the initial monogram.
function safeImageUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  const normalized = parsed.toString();
  if (normalized.includes('"') || normalized.includes('\\')) return null;
  return normalized;
}

type ShellRightRailProps = {
  currentUser: ShellCurrentUser;
  trust: TrustUserExtension;
  isAuthenticated?: boolean;
  signInUrl?: string;
};

export function ShellRightRail({ currentUser, trust, isAuthenticated = false, signInUrl = '/sign-in' }: ShellRightRailProps) {
  const initial = currentUser.initial;
  // Clerk photo when the member has uploaded one, so this card matches the avatar the icon-rail
  // UserButton shows for the same person (it was a gradient monogram here vs. a photo there).
  // Rendered as a background image on the existing avatar div (the repo uses no raw <img>), so the
  // profileAvatar sizing/border-radius/comic-theme border all still apply. Falls back to the initial
  // monogram when there is no photo or the user is signed out.
  const { user } = useUser();
  const photoUrl = safeImageUrl(user?.imageUrl);
  const avatar = photoUrl ? (
    <div
      className={styles.profileAvatar}
      style={{ backgroundImage: `url("${photoUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      aria-hidden="true"
    />
  ) : (
    <div className={styles.profileAvatar} aria-hidden="true">{initial}</div>
  );

  if (!isAuthenticated) {
    return (
      <aside className={`${styles.panel} ${styles.rightRail}`}>
        <section className={styles.profileCard}>
          {avatar}
          <p className={styles.profileName}>Welcome to Skills Economy</p>
          <p className={styles.profileMeta}>Sign in to access full features and connect with your community</p>
          <Link href={signInUrl} className={styles.profileLoginBtn}>Sign In</Link>
        </section>

        <section className={styles.quoteCard}>
          <p className={styles.quoteText}>&ldquo;You are not what happened to you. You are what you choose to become.&rdquo;</p>
          <p className={styles.quoteAuthor}>— Carl Jung</p>
        </section>

        <section>
          <p className={styles.rightRailSectionTitle}>About Skills Economy</p>
          <p className={styles.sectionDesc}>Not sure where to start? Just say what you need in the chat — housing, work, safety, or someone to talk to — and we&apos;ll point you to the right place.</p>
        </section>
      </aside>
    );
  }

  return (
    <aside className={`${styles.panel} ${styles.rightRail}`}>
      <section className={styles.profileCard}>
        {avatar}
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
