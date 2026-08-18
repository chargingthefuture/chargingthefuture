'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import { ChevronRight, Database, Download, HeartHandshake, Image as ImageIcon, ShieldCheck, ShieldOff, Smartphone, Sparkles, UserCircle } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getAccountDataTokens } from '@/components/account-data/account-data-shared';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { TrustRightRailCard } from '@/components/shared/trust/TrustRightRailCard';
import type { TrustUserExtension } from 'lib/trust/types';

// Everything installable — the Android APK and the phone wallpapers — is downloaded from the repo's
// GitHub Releases page (owner decision 2026-08-18: one page for all downloads, matching the Chyme
// shell's "Get the Android app" card and the landing page's download links). The wallpapers link
// pre-filters that page to the wallpapers-v* releases.
const RELEASES_URL = 'https://github.com/chargingthefuture/chargingthefuture/releases';
const WALLPAPERS_URL = 'https://github.com/chargingthefuture/chargingthefuture/releases?q=wallpapers';

// One identity, shown wherever it lives. This hub does not store a profile — it routes the member to
// the real place each part is edited, so they never feel like they are filling in "another profile".
export function AccountHubShell({ username, trust }: { username: string | null; trust: TrustUserExtension }) {
  const { theme } = useTheme();
  const tok = getAccountDataTokens(theme);
  const handle = username ? `@${username}` : 'Member';
  const initial = username ? username.charAt(0).toUpperCase() : 'S';

  const cardStyle: CSSProperties = {
    background: tok.SURFACE,
    border: `1px solid ${tok.BORDER}`,
    borderRadius: 14,
    padding: '18px 20px',
    marginBottom: 16,
  };
  const sectionLabel: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: tok.SUBTLE,
    marginBottom: 10,
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', background: tok.BG, color: tok.TEXT, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      {/* The shared header carries the back + account controls at phone width, matching every plugin shell. */}
      <div style={{ flex: 1, minWidth: 0, height: '100dvh', overflowY: 'auto' }}>
        <MobileScreenHeader title="Your account" accent={tok.BRAND} icon={<UserCircle size={18} color={tok.BRAND} />} />
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px' }}>
          <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Your account</h1>
          <p style={{ fontSize: 14, color: tok.SUBTLE, lineHeight: 1.6, margin: 0 }}>
            You have one identity across Skills Economy. Here is everywhere it shows up — update each part where it lives.
          </p>
        </header>

        {/* Identity — name, username, photo, email (managed by the account provider) */}
        <section style={cardStyle}>
          <div style={sectionLabel}>Identity</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${tok.BRAND}22`, border: `1px solid ${tok.BRAND}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: tok.BRAND, flexShrink: 0 }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{handle}</div>
              <div style={{ fontSize: 13, color: tok.SUBTLE }}>Your name, username, photo, and email</div>
            </div>
            {/* Clerk's account menu is the one place identity basics are edited. */}
            <span title="Manage your name, username, photo, and email" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserButton />
            </span>
          </div>
        </section>

        {/* Trust — earned through participation, not a form */}
        <section style={cardStyle}>
          <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={12} /> Trust
          </div>
          <TrustRightRailCard trust={trust} />
          <p style={{ fontSize: 12, color: tok.SUBTLE, lineHeight: 1.6, margin: 0 }}>
            Trust is earned by taking part — completing your profile, making a transaction, and using the plugins. There is nothing to fill in here.
          </p>
        </section>

        {/* Your ongoing activities — the ties you acknowledge with other members */}
        <section style={cardStyle}>
          <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HeartHandshake size={12} /> Your ongoing activities
          </div>
          <AccountLinkRow
            href="/apps/recurring-activity"
            icon={<HeartHandshake size={18} />}
            title="Recurring activity"
            desc="Acknowledge the ongoing ties you share with another member. Recognition, never a bill — and yours to keep private."
            tok={tok}
            last
          />
        </section>

        {/* Verification lives on the account page because it is not part of any plugin's profile —
            it confirms the member with their Quora URL to unlock full access. The member's actual
            profile (headline, skills, pay info) is the shared directory_profiles row, edited inside
            the Directory plugin; housing is a collection of posts in LightHouse. Neither is a second
            "profile" to manage here, so this section carries only verification. */}
        <section style={cardStyle}>
          <div style={sectionLabel}>Verification</div>
          <AccountLinkRow
            href="/plugin/unlock"
            icon={<ShieldCheck size={18} />}
            title="Verification"
            desc="Confirm you are a real person with your Quora profile to unlock full access."
            tok={tok}
            last
          />
        </section>

        {/* Data & privacy */}
        <section style={cardStyle}>
          <div style={sectionLabel}>Data &amp; privacy</div>
          <AccountLinkRow
            href="/account/data"
            icon={<Database size={18} />}
            title="Your data &amp; deletion"
            desc="See everything the platform stores about you, and delete it — one service or your whole account."
            tok={tok}
          />
          <AccountLinkRow
            href="/account/blocks"
            icon={<ShieldOff size={18} />}
            title="Blocked members"
            desc="See who you&apos;ve blocked and unblock them. Blocked people can&apos;t see or contact you, and they&apos;re never told."
            tok={tok}
            last
          />
        </section>

        {/* Downloads — both live on the GitHub Releases page, one place to get everything installable */}
        <section style={cardStyle}>
          <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={12} /> Downloads
          </div>
          <AccountLinkRow
            href={RELEASES_URL}
            external
            icon={<Smartphone size={18} />}
            title="Android app (APK)"
            desc="Download the native Android app from the project&apos;s GitHub releases page."
            tok={tok}
          />
          <AccountLinkRow
            href={WALLPAPERS_URL}
            external
            icon={<ImageIcon size={18} />}
            title="Phone wallpapers"
            desc="Skills Economy wallpapers for your phone, from the same releases page."
            tok={tok}
            last
          />
        </section>
        </div>
      </div>
    </div>
  );
}

function AccountLinkRow({
  href,
  icon,
  title,
  desc,
  tok,
  last = false,
  external = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  desc: string;
  tok: ReturnType<typeof getAccountDataTokens>;
  last?: boolean;
  external?: boolean;
}) {
  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 4px',
    borderBottom: last ? 'none' : `1px solid ${tok.BORDER}`,
    textDecoration: 'none',
    color: tok.TEXT,
  };
  const body = (
    <>
      <span style={{ color: tok.BRAND, flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: tok.SUBTLE, lineHeight: 1.5 }}>{desc}</span>
      </span>
      <ChevronRight size={16} style={{ color: tok.SUBTLE, flexShrink: 0 }} />
    </>
  );
  // External rows (GitHub releases) leave the app, so they open in a new tab and skip next/link.
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={rowStyle}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} style={rowStyle}>
      {body}
    </Link>
  );
}
