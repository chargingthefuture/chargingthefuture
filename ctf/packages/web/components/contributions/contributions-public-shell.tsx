'use client';

import { Gift, Lock, ChevronRight } from 'lucide-react';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import {
  FONT_FAMILY,
  getContributionsTokens,
  type ContributionsTokens,
} from './contributions-shared';
import { PublicShellWorldwide } from '@/components/plugins/public-shell-worldwide';

// The signed-out view. It shows no figures: a signed-out visitor has no session, so any amount or
// count here would be made up. It says what a contribution is and asks the visitor to sign in.
const INTRO =
  'The app is free and stays free. Hosting is paid out of pocket, so members who are able can send an Amazon gift card, any time of year, from $1 to $500. Every contribution is private, and a confirmed one earns ServiceCredits as a thank-you.';

const HOW_IT_WORKS = [
  'Type the amount and the code from the card.',
  'The code is stored encrypted and erased once the System Architect has confirmed or rejected it.',
  'Once confirmed, thank-you ServiceCredits arrive in your account.',
];

// Shared size-dependent style values for the auth buttons. The `full` variant (used in the mobile
// sign-in card) is a wider, taller button; the compact variant is used inline elsewhere.
function ctaSize(full?: boolean): Pick<React.CSSProperties, 'padding' | 'borderRadius' | 'fontSize'> {
  return {
    padding: full ? '11px' : '9px 18px',
    borderRadius: full ? 9 : 8,
    fontSize: full ? 14 : 13,
  };
}

// The "Finish verifying" button shown to a signed-in but unverified member.
function VerifyCta({ verifyUrl, t, full }: { verifyUrl: string; t: ContributionsTokens; full?: boolean }) {
  return (
    <a
      href={verifyUrl}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        ...ctaSize(full),
        width: full ? '100%' : undefined,
        background: t.ACCENT,
        border: 'none',
        color: '#fff',
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'none',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      Finish verifying <ChevronRight size={full ? 15 : 14} />
    </a>
  );
}

// "Join free" (primary sign-up) and "Sign in" (secondary). Both point at the same hosted auth URL,
// which handles sign-up vs sign-in.
function JoinSignInCtas({ signInUrl, t, full }: { signInUrl: string; t: ContributionsTokens; full?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: full ? '100%' : undefined, flexShrink: 0 }}>
      <a
        href={signInUrl}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          ...ctaSize(full),
          flex: full ? 1 : undefined,
          background: t.ACCENT,
          border: 'none',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        Join free <ChevronRight size={full ? 15 : 14} />
      </a>
      <a
        href={signInUrl}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...ctaSize(full),
          flex: full ? 1 : undefined,
          background: 'transparent',
          border: `1px solid ${t.BORDER_SOLID}`,
          color: t.TITLE,
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        Sign in
      </a>
    </div>
  );
}

// Call-to-action buttons for the sign-in card. In verify mode (a signed-in but unverified member)
// the single "Finish verifying" button is the only action. Otherwise both paths are shown so it is
// clear there is a way in for new and returning members alike.
function AuthCtas({ signInUrl, verifyUrl, t, full }: { signInUrl: string; verifyUrl?: string; t: ContributionsTokens; full?: boolean }) {
  if (verifyUrl) {
    return <VerifyCta verifyUrl={verifyUrl} t={t} full={full} />;
  }
  return <JoinSignInCtas signInUrl={signInUrl} t={t} full={full} />;
}

function MobilePublic({ signInUrl, verifyUrl, t }: { signInUrl: string; verifyUrl?: string; t: ContributionsTokens }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <PublicShellBackLink />
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.TITLE }}>Contributions</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Amazon gift cards, any time of year</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.8, margin: '0 0 22px' }}>{INTRO}</p>
        <PublicShellWorldwide color={t.MUTED} style={{ margin: '-10px 0 22px' }} />

        <div style={{ background: t.SURFACE, borderRadius: 12, padding: 16, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 12 }}>How it works</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HOW_IT_WORKS.map((line) => (
              <li key={line} style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>
                {line}
              </li>
            ))}
          </ol>
        </div>

        <div style={{ background: `${t.ACCENT}0C`, borderRadius: 12, padding: 18, border: `1px solid ${t.ACCENT}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={16} color={t.ACCENT} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE }}>
                {verifyUrl ? 'Finish verifying to contribute' : 'Join or sign in to contribute'}
              </div>
              <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>Available to signed-in members</div>
            </div>
          </div>
          <AuthCtas signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} full />
        </div>
      </div>
    </div>
  );
}

// Signed-out visitor view for Contributions: what a contribution is, how it works, and a sign-in (or
// finish-verifying) call to action. It fetches no private or per-user data.
export function ContributionsPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const { theme } = useTheme();
  const t = getContributionsTokens(theme);
  return <MobilePublic signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} />;
}
