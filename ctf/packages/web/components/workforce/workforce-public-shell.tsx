'use client';

import { BarChart2, TrendingUp, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the WorkforcePublic / MobileWorkforcePublic design mockups.
const BG = '#0F1117';
const COLOR = '#B45309';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Snapshot categories from the mockup. The mockup filled these bars with sample
// percentages; a public visitor has no session, so the bars render empty as a
// neutral placeholder rather than showing fabricated distribution figures.
const SNAPSHOT = [
  { label: 'Employed', color: '#22C55E' },
  { label: 'In Training', color: COLOR },
  { label: 'Seeking Work', color: '#F59E0B' },
  { label: 'Exploring', color: '#6B7280' },
];

function DesktopWorkforcePublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <BarChart2 size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Workforce</span>
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
      <div style={{ padding: '48px 64px 32px', display: 'flex', gap: 80 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
            5M survivor goal
          </span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
            Real-time workforce data<br />
            <span style={{ color: COLOR }}>for every survivor</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 460 }}>
            Live skills distribution, employment gaps, and personalized pathways across our growing network. Your workforce coach lives here.
          </p>
          <a href={verifyUrl ?? signInUrl} style={{ marginTop: 8, padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
          </a>
        </div>

        {/* Snapshot — empty bars (no fabricated distribution) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live workforce snapshot</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SNAPSHOT.map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 80, fontSize: 12, color: '#9CA3AF' }}>{label}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: SUBTLE, width: 32, textAlign: 'right' }}>—</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.5 }}>The snapshot fills in once you sign in.</div>
        </div>
      </div>

      {/* Skill gap table — locked behind sign-in (no fabricated figures) */}
      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <TrendingUp size={14} color={COLOR} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Top skill gaps right now</span>
          </div>
          {SNAPSHOT.map((_, i) => (
            <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, flex: 1, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ width: 80, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ width: 40, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={COLOR} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to see your personalized pathway</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Sign in to access Workforce'}
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileWorkforcePublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Workforce</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600, width: 'fit-content' }}>5M survivor goal</span>
        <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>Real-time skills distribution, employment gaps, and personalized pathways across our growing network.</p>

        {/* Snapshot — empty bars (no fabricated distribution) */}
        <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 10 }}>Live snapshot</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SNAPSHOT.map(({ label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 65, fontSize: 11, color: '#9CA3AF' }}>{label}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: SUBTLE, width: 28, textAlign: 'right' }}>—</span>
              </div>
            ))}
          </div>
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative', minHeight: 300 }}>
        <div style={{ height: 200, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }} aria-hidden />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={COLOR} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>Sign in for your personalized pathway</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Workforce. Pixel-faithful to the WorkforcePublic
 * (desktop) and MobileWorkforcePublic (phone) design mockups, with every
 * sign-in, join, and call-to-action pointing at the real hosted sign-in URL.
 *
 * Real-data-only deviation (no session = no private/fabricated data): the
 * mockup hardcoded a live snapshot (37/25/20/18% bars), a "4.9M survivors
 * tracked" count, and a blurred skill-gap table with invented unmet-demand
 * numbers and trends. The snapshot bars render empty with neutral dashes, the
 * fabricated survivor count is dropped (the badge keeps only the stated "5M
 * survivor goal"), and the gap table keeps the same blurred lock layout with
 * neutral placeholder rows instead of invented figures. The simulated phone
 * status bar is dropped because the real app renders inside the browser chrome.
 */
export function WorkforcePublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileWorkforcePublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopWorkforcePublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
