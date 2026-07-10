'use client';

import { Heart, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getGentlePulseTokens } from './gp-shared';

// Chrome palette comes from getGentlePulseTokens (default branch = the shipped
// GentlePulsePublic / MobileGentlePulsePublic mockup values).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function DesktopGentlePulsePublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, borderBottom: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <Heart size={18} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>GentlePulse</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Finish verifying</a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.25)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
          )}
        </div>
      </div>

      <div style={{ padding: '48px 64px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ padding: '4px 14px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 12, color: t.ACCENT, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
          Trauma-informed wellness
        </span>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
          Guided meditation built<br /><span style={{ color: t.ACCENT }}>for survivors, by therapists</span>
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: t.SUBTLE, maxWidth: 500 }}>
          Every session is written and reviewed by certified trauma therapists. Breathing, grounding, sleep, mindfulness — all free with your Hub membership.
        </p>
        <a href={verifyUrl ?? signInUrl} style={{ marginTop: 8, padding: '14px 32px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
        </a>
      </div>

      {/* Sign-in gate (no fabricated session list) */}
      <div style={{ padding: '0 64px 48px' }}>
        <div style={{ borderRadius: 14, border: '1px solid rgba(20,184,166,0.12)', background: 'rgba(20,184,166,0.03)', padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={22} color={t.ACCENT} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to access all sessions</div>
          <div style={{ fontSize: 13, color: t.MUTED, textAlign: 'center', maxWidth: 300 }}>Save progress, track streaks, and get personalized recommendations.</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in to begin healing'}</a>
        </div>
      </div>
    </div>
  );
}

function MobileGentlePulsePublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Heart size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>GentlePulse</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>Trauma-informed wellness</span>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Guided meditation and breathwork written by certified trauma therapists. Breathing, grounding, sleep, mindfulness — all free.</p>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      {/* Sign-in gate (no fabricated session list) */}
      <div style={{ flex: 1, padding: '0 20px 20px' }}>
        <div style={{ height: '100%', minHeight: 240, borderRadius: 12, border: '1px solid rgba(20,184,166,0.12)', background: 'rgba(20,184,166,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in for all sessions</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for GentlePulse. Pixel-faithful to the
 * GentlePulsePublic (desktop) and MobileGentlePulsePublic (phone) design
 * mockups, with sign-in affordances pointing at the real hosted sign-in URL.
 *
 * Real-data-only deviation (no session = no private/fabricated data): the
 * mockup's blurred session list (4-7-8 Breathing, Sleep Sanctuary, … with
 * invented "47.8k plays" counts) is sample data, so it is replaced with an
 * honest sign-in gate. The marketing hero copy is kept. The simulated phone
 * status bar is dropped because the real app renders inside the browser chrome.
 */
export function GentlePulsePublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileGentlePulsePublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopGentlePulsePublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
