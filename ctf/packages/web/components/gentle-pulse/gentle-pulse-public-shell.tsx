'use client';

import { Heart, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getGentlePulseTokens } from './gp-shared';

// Chrome palette comes from getGentlePulseTokens (default branch = the shipped
// GentlePulsePublic / MobileGentlePulsePublic mockup values).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

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
  return <MobileGentlePulsePublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
