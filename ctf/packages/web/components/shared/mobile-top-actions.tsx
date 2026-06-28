'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { Settings, Bug } from 'lucide-react';
import { BugReportModal } from '@/components/bug-reports/bug-report-modal';

// The right-hand cluster of the mobile top bar — the controls that live in the bottom of the desktop
// left rail (report a bug, account & settings, the account menu / sign-out) gathered into one place so
// every plugin and admin screen carries them at phone width. The desktop rails keep their own copies;
// this is the mobile equivalent, dropped into each plugin's existing on-brand mobile header (and into
// the shared MobileScreenHeader for admin screens that have no header of their own).
//
// Styled with the neutral theme tokens (not a plugin accent) so it reads as system chrome and looks
// the same on every screen; the host header supplies the brand accent on the back button and title.
const ICON_BTN: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ctf-text, #E5E7EB)',
  background: 'var(--ctf-surface, rgba(255, 255, 255, 0.06))',
  border: '1px solid var(--ctf-border, rgba(255, 255, 255, 0.12))',
  textDecoration: 'none',
  cursor: 'pointer',
  flexShrink: 0,
};

export function MobileTopActions() {
  const [bugOpen, setBugOpen] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setBugOpen(true)}
        aria-label="Report a bug"
        title="Report a bug"
        style={ICON_BTN}
      >
        <Bug size={18} aria-hidden="true" />
      </button>

      <Link href="/account" aria-label="Account and settings" title="Account and settings" style={ICON_BTN}>
        <Settings size={18} aria-hidden="true" />
      </Link>

      <span
        title="Your account — manage your profile or sign out"
        style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        <UserButton />
      </span>

      <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
    </div>
  );
}
