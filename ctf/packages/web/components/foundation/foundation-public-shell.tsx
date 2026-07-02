'use client';

import { Hammer, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the FoundationPublic / MobileFoundationPublic design mockups.
const BG = '#0F1117';
const COLOR = '#F59E0B';
const TEXT = '#F9FAFB';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function DesktopFoundationPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <Hammer size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Foundation</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              Sign In
            </a>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '48px 64px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
          Trades &amp; skilled services
        </span>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
          Find trusted tradespeople<br />
          <span style={{ color: COLOR }}>who accept ServiceCredits</span>
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 520 }}>
          Electricians, plumbers, carpenters, HVAC techs, and more — fellow community members. Pay with ServiceCredits or cash.
        </p>
        <a href={verifyUrl ?? signInUrl} style={{ marginTop: 8, padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
        </a>
      </div>

      {/* Sign-in gate (no fabricated provider cards) */}
      <div style={{ padding: '0 64px 48px' }}>
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={COLOR} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to book tradespeople</div>
          <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 300 }}>
            Filter by trade, location, availability, and Service Credit acceptance.
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Sign in to access Foundation'}
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileFoundationPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Hammer size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Foundation</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>Electricians, plumbers, carpenters, and more — fellow community members. Pay with ServiceCredits.</p>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      {/* Sign-in gate (no fabricated provider cards) */}
      <div style={{ flex: 1, padding: '0 20px 20px' }}>
        <div style={{ height: '100%', minHeight: 240, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={COLOR} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to book tradespeople</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
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
  const isMobile = useIsMobile();
  return isMobile ? <MobileFoundationPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopFoundationPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
