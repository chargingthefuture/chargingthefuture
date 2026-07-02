'use client';

import { Shield, CheckCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';

// Palette from the TrustPublic / MobileTrustPublic design mockups.
const BG = '#0F1117';
const COLOR = '#0EA5E9';
const TEXT = '#F9FAFB';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Static description of the voluntary signals Trust aggregates (marketing copy).
const DESKTOP_SIGNALS = [
  'Identity verification',
  'Survivor-status attestation (non-coercive)',
  'Service Credit transaction history',
  'Community peer vouches',
  'Cohort completion record',
];

const MOBILE_SIGNALS = [
  'Identity verification',
  'Survivor-status attestation',
  'Service Credit history',
  'Community peer vouches',
  'Cohort completion record',
];

function DesktopTrustPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <Shield size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Trust</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Finish verifying</a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
        <div style={{ maxWidth: 640, display: 'flex', gap: 56, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
              Privacy-respecting identity
            </span>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>
              Your Trust score proves<br />
              <span style={{ color: COLOR }}>you&apos;re real — without exposing who you are</span>
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF' }}>
              Trust aggregates voluntary signals to establish credibility on the platform. Providers and peers can trust you. You reveal nothing beyond what you choose.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DESKTOP_SIGNALS.map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={14} color={COLOR} />
                  <span style={{ fontSize: 14, color: '#D1D5DB' }}>{s}</span>
                </div>
              ))}
            </div>
            <a href={verifyUrl ?? signInUrl} style={{ marginTop: 8, padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', textDecoration: 'none' }}>
              {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
            </a>
          </div>

          {/* Trust score preview (empty state — no fabricated score) */}
          <div style={{ width: 240, borderRadius: 16, border: `1px solid ${COLOR}30`, padding: '24px 20px', background: COLOR + '06', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, border: `3px solid ${COLOR}`, background: COLOR + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={32} color={COLOR} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Your Trust Score</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: COLOR, marginTop: 2 }}>—</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Sign in to build yours</div>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DESKTOP_SIGNALS.slice(0, 3).map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', opacity: 0.4 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, border: `1px solid ${COLOR}50` }} />
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{s}</span>
                </div>
              ))}
            </div>
            <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '11px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box', textDecoration: 'none' }}>
              {verifyUrl ? 'Finish verifying' : 'Sign in to verify'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileTrustPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ flex: 1, padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Shield size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Trust</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600, width: 'fit-content' }}>Privacy-respecting identity</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
          Prove you&apos;re real.<br />
          <span style={{ color: COLOR }}>Without exposing who you are.</span>
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>Trust aggregates voluntary signals to establish credibility. Providers and peers can trust you — you reveal nothing beyond what you choose.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MOBILE_SIGNALS.map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={13} color={COLOR} />
              <span style={{ fontSize: 13, color: '#D1D5DB' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Trust score preview card (empty state) */}
        <div style={{ borderRadius: 16, border: `1px solid ${COLOR}30`, padding: '20px', background: COLOR + '06', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 60, height: 60, borderRadius: 30, border: `3px solid ${COLOR}`, background: COLOR + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={26} color={COLOR} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#6B7280' }}>Your Trust Score</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: COLOR, marginTop: 2 }}>—</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Sign in to build yours</div>
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '13px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Trust. Pixel-faithful to the TrustPublic (desktop)
 * and MobileTrustPublic (phone) design mockups, with every sign-in affordance
 * pointing at the real hosted sign-in URL.
 *
 * Real-data-only note: the mockup already renders the score as an em-dash ("—")
 * empty state and the signal list is static marketing copy describing what Trust
 * aggregates, so there is no fabricated per-user data to remove. The simulated
 * phone status bar is dropped because the real app renders inside the browser
 * chrome.
 */
export function TrustPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileTrustPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopTrustPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
