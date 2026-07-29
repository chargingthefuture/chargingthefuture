'use client';

import { Hammer, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { getFoundationTokens } from './foundation-ui';

// Layout from the FoundationPublic / MobileFoundationPublic design mockups; chrome colors come from
// the shared Foundation theme tokens (default theme returns the exact shipped hex).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function MobileFoundationPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Hammer size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Foundation</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Electricians, plumbers, carpenters, and more — fellow community members. Pay with ServiceCredits.</p>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join Skills Economy — Free'}</a>
      </div>

      {/* Sign-in gate (no fabricated provider cards) */}
      <div style={{ flex: 1, padding: '0 20px 20px' }}>
        <div style={{ height: '100%', minHeight: 240, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to book tradespeople</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Foundation. Pixel-faithful to the FoundationPublic
 * (desktop) and MobileFoundationPublic (phone) design mockups, with sign-in
 * affordances pointing at the real hosted sign-in URL.
 *
 * Real-data-only deviation (no session = no private/fabricated data): the
 * mockup's blurred provider preview cards (Carlos Rivera, Sarah Johnson, … with
 * invented rates and ratings) are sample data, so they are replaced with an
 * honest sign-in gate. The marketing hero copy is kept. The simulated phone
 * status bar is dropped because the real app renders inside the browser chrome.
 */
export function FoundationPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileFoundationPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
