'use client';

import { HeartHandshake, Lock, UserPlus, Repeat, EyeOff, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import {
  COMMUNITY_LINE,
  FONT_FAMILY,
  getRecurringActivityTokens,
  type RecurringActivityTokens,
} from './recurring-activity-shared';

// Signed-out visitor view for Recurring Activity. Marketing copy only — per rule 126 it shows no
// private or per-user data (the visitor has no session). The three feature tiles are static; the
// real activities load only after sign-in. Sign-in affordances point at the hosted sign-in URL; a
// signed-in-but-not-yet-verified member gets a single "Finish verifying" CTA (verifyUrl) instead.

const INTRO =
  'Acknowledge an ongoing activity you share with another member — one tap to recognize an everyday tie. No money changes hands: it is a note to each other, never a bill.';

const FEATURES: Array<{ Icon: typeof Repeat; label: string; desc: string }> = [
  { Icon: Repeat, label: 'One tap', desc: 'Mark an ongoing tie — no charge, nothing owed.' },
  { Icon: EyeOff, label: 'No bill', desc: 'No money moves — it is recognition, not a charge.' },
  { Icon: Users, label: 'Between members', desc: 'Both sides confirm; you decide who can see it.' },
];

function CtaButtons({
  signInUrl,
  verifyUrl,
  t,
  size,
}: {
  signInUrl: string;
  verifyUrl?: string;
  t: RecurringActivityTokens;
  size: 'sm' | 'lg';
}) {
  const pad = size === 'lg' ? '14px 28px' : '7px 16px';
  const radius = size === 'lg' ? 10 : 8;
  const fontSize = size === 'lg' ? 15 : 13;
  if (verifyUrl) {
    return (
      <a
        href={verifyUrl}
        style={{ padding: pad, borderRadius: radius, background: t.ACCENT, border: 'none', color: '#04211D', fontSize, fontWeight: 700, textDecoration: 'none' }}
      >
        Finish verifying
      </a>
    );
  }
  return (
    <>
      <a
        href={signInUrl}
        style={{ padding: pad, borderRadius: radius, background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.BORDER}`, color: t.TEXT, fontSize, fontWeight: 600, textDecoration: 'none' }}
      >
        Sign In
      </a>
      <a
        href={signInUrl}
        style={{ padding: pad, borderRadius: radius, background: t.ACCENT, border: 'none', color: '#04211D', fontSize, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
      >
        <UserPlus size={fontSize} /> Join Free
      </a>
    </>
  );
}

function Header({ signInUrl, verifyUrl, t, isMobile }: { signInUrl: string; verifyUrl?: string; t: RecurringActivityTokens; isMobile: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: isMobile ? '12px 16px' : '0 28px',
        height: isMobile ? undefined : 52,
        background: isMobile ? `${t.ACCENT}10` : undefined,
        borderBottom: `1px solid ${isMobile ? `${t.ACCENT}25` : t.BORDER}`,
        flexShrink: 0,
      }}
    >
      <PublicShellBackLink />
      <HeartHandshake size={18} color={t.ACCENT} />
      <span style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>Recurring Activity</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: isMobile ? 6 : 8 }}>
        <CtaButtons signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} size="sm" />
      </div>
    </div>
  );
}

function FeatureTiles({ t }: { t: RecurringActivityTokens }) {
  return (
    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
      {FEATURES.map(({ Icon, label, desc }) => (
        <div key={label} style={{ flex: 1, padding: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, textAlign: 'center' }}>
          <Icon size={20} color={t.ACCENT} style={{ marginBottom: 8, opacity: 0.8 }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>{desc}</div>
        </div>
      ))}
    </div>
  );
}

function LockedMark({ t, size }: { t: RecurringActivityTokens; size: number }) {
  const lock = Math.round(size * 0.33);
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `${t.ACCENT}1A`,
          border: `4px solid ${t.ACCENT}4D`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          filter: 'blur(2px)',
          opacity: 0.5,
        }}
      >
        <HeartHandshake size={Math.round(size * 0.25)} color={t.ACCENT} />
        <span style={{ fontSize: 13, fontWeight: 800, color: t.ACCENT }}>Acknowledge</span>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: lock, height: lock, borderRadius: '50%', background: `${t.ACCENT}26`, border: `2px solid ${t.ACCENT}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Lock size={Math.round(lock * 0.42)} color={t.ACCENT} />
        </div>
      </div>
    </div>
  );
}

function DesktopPublic({ signInUrl, verifyUrl, t }: { signInUrl: string; verifyUrl?: string; t: RecurringActivityTokens }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <Header signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} isMobile={false} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 64px' }}>
        <div style={{ maxWidth: 600, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
          <LockedMark t={t} size={160} />
          <div>
            <h1 style={{ margin: '0 0 12px', fontSize: 30, fontWeight: 800, lineHeight: 1.2, color: t.TITLE }}>
              Recognize the ties you keep.<br />
              <span style={{ color: t.ACCENT }}>Sign in to start.</span>
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: t.MUTED, lineHeight: 1.7, maxWidth: 460 }}>{INTRO}</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <CtaButtons signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} size="lg" />
          </div>
          <FeatureTiles t={t} />
          <p style={{ margin: 0, fontSize: 12, color: t.MUTED }}>{COMMUNITY_LINE}</p>
        </div>
      </div>
    </div>
  );
}

function MobilePublic({ signInUrl, verifyUrl, t }: { signInUrl: string; verifyUrl?: string; t: RecurringActivityTokens }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <Header signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} isMobile />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 24px', textAlign: 'center', gap: 22 }}>
        <LockedMark t={t} size={140} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 8 }}>Recognize the ties you keep</div>
          <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, maxWidth: 300 }}>{INTRO}</div>
        </div>
        <a
          href={verifyUrl ?? signInUrl}
          style={{ width: '100%', padding: 14, borderRadius: 12, background: t.ACCENT, border: 'none', color: '#04211D', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', textDecoration: 'none' }}
        >
          {verifyUrl ? 'Finish verifying' : <><UserPlus size={15} /> Create free account</>}
        </a>
        <FeatureTiles t={t} />
        <p style={{ margin: 0, fontSize: 11, color: t.MUTED }}>{COMMUNITY_LINE}</p>
      </div>
    </div>
  );
}

export function RecurringActivityPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getRecurringActivityTokens(theme);
  return isMobile
    ? <MobilePublic signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} />
    : <DesktopPublic signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} />;
}
