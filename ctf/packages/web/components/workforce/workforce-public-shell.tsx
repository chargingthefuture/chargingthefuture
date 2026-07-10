'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getWorkforceTokens } from './workforce-shared';

// Layout from the WorkforcePublic / MobileWorkforcePublic design mockups; chrome colors come from
// the shared Workforce theme tokens (default theme returns the exact shipped hex).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

type WorkforceSnapshot = { recruited: number; sectorGaps: number };

// The real, public aggregate counts the snapshot shows. These are the signed-out marketing labels:
// "Sectors to fill" is the count of active sectors with demand (the signed-in dashboard calls the same
// figure "Sector Gaps" — internal framing, not for the public page). "Not Recruited" (the unfilled
// headcount target against the 5M goal) is intentionally left out — it is a multi-million number that
// reads as off-putting marketing — so the public endpoint does not return it either.
// `color` is the status/data-viz swatch for the bar; a row without one uses the plugin accent
// (resolved in-component, because the theme hook is not available at module scope).
const SNAPSHOT_ROWS: { key: keyof WorkforceSnapshot; label: string; color?: string }[] = [
  { key: 'recruited', label: 'Recruited', color: '#22C55E' },
  { key: 'sectorGaps', label: 'Sectors to fill' },
];

// Fetches the live, signed-out workforce snapshot. Returns null while loading or if the endpoint is
// unavailable, so the bars fall back to neutral dashes rather than showing a fabricated distribution.
function useWorkforceSnapshot(): WorkforceSnapshot | null {
  const [snapshot, setSnapshot] = useState<WorkforceSnapshot | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/workforce/public-snapshot', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && typeof data.recruited === 'number') {
          setSnapshot({ recruited: data.recruited, sectorGaps: data.sectorGaps });
        }
      })
      .catch(() => {
        /* leave null — the snapshot degrades to neutral dashes */
      });
    return () => {
      active = false;
    };
  }, []);
  return snapshot;
}

function snapshotMax(snapshot: WorkforceSnapshot | null): number {
  if (!snapshot) {
    return 1;
  }
  return Math.max(1, snapshot.recruited, snapshot.sectorGaps);
}

function DesktopWorkforcePublic({ signInUrl, verifyUrl, snapshot }: { signInUrl: string; verifyUrl?: string; snapshot: WorkforceSnapshot | null }) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const max = snapshotMax(snapshot);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <BarChart2 size={18} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Workforce</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: t.BORDER_STRONG, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              Sign In
            </a>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '48px 64px 32px', display: 'flex', gap: 80 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 12, color: t.ACCENT, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
            5M survivor goal
          </span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
            Real-time workforce data<br />
            <span style={{ color: t.ACCENT }}>for every survivor</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: t.SUBTLE, maxWidth: 460 }}>
            Live skills distribution, employment gaps, and personalized pathways across our growing network. Your workforce coach lives here.
          </p>
          <a href={verifyUrl ?? signInUrl} style={{ marginTop: 8, padding: '14px 32px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
          </a>
        </div>

        {/* Live snapshot — real network-wide aggregate counts (no per-member data). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.FAINT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live workforce snapshot</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SNAPSHOT_ROWS.map(({ key, label, color }) => {
              const value = snapshot ? snapshot[key] : null;
              const pct = snapshot ? Math.round((snapshot[key] / max) * 100) : 0;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 96, fontSize: 12, color: t.SUBTLE }}>{label}</div>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color ?? t.ACCENT, transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: value != null ? t.TITLE : t.MUTED, minWidth: 48, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {value != null ? value.toLocaleString() : '—'}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>Live across the network. Sign in for your personalized pathway.</div>
        </div>
      </div>

      {/* Skill gap table — locked behind sign-in (no fabricated figures) */}
      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.BORDER}`, display: 'flex', gap: 8, alignItems: 'center' }}>
            <TrendingUp size={14} color={t.ACCENT} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Top skill gaps right now</span>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, flex: 1, height: 10, borderRadius: 4, background: t.BORDER }} />
              <div style={{ width: 80, height: 10, borderRadius: 4, background: t.BORDER }} />
              <div style={{ width: 40, height: 10, borderRadius: 4, background: t.BORDER }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to see your personalized pathway</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Sign in to access Workforce'}
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileWorkforcePublic({ signInUrl, verifyUrl, snapshot }: { signInUrl: string; verifyUrl?: string; snapshot: WorkforceSnapshot | null }) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const max = snapshotMax(snapshot);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <BarChart2 size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Workforce</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>5M survivor goal</span>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Real-time skills distribution, employment gaps, and personalized pathways across our growing network.</p>

        {/* Live snapshot — real network-wide aggregate counts (no per-member data). */}
        <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 10 }}>Live snapshot</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SNAPSHOT_ROWS.map(({ key, label, color }) => {
              const value = snapshot ? snapshot[key] : null;
              const pct = snapshot ? Math.round((snapshot[key] / max) * 100) : 0;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 78, fontSize: 11, color: t.SUBTLE }}>{label}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color ?? t.ACCENT, transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: value != null ? t.TITLE : t.MUTED, minWidth: 40, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {value != null ? value.toLocaleString() : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative', minHeight: 300 }}>
        <div style={{ height: 200, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.4, borderRadius: 12, border: `1px solid ${t.BORDER}`, background: 'rgba(255,255,255,0.02)' }} aria-hidden />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>Sign in for your personalized pathway</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
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
 * The "Live snapshot" shows real network-wide aggregate counts — Recruited and
 * "Sectors to fill" (the active-sector figure the signed-in dashboard calls
 * "Sector Gaps"; the public page uses the positive marketing label) — fetched
 * from the public `/api/workforce/public-snapshot`
 * endpoint (no per-member or identifying data). The unfilled-headcount-target
 * figure ("Not Recruited") is deliberately omitted: against the 5M goal it is a
 * multi-million number that reads as off-putting marketing, so it is left out of
 * both the endpoint and the page. The bars scale to the larger of the two; while
 * the snapshot is loading or if the endpoint is unavailable, they degrade to
 * neutral dashes rather than showing a fabricated distribution. The per-survivor
 * skill-gap table stays locked behind
 * sign-in. The mockup's invented figures (37/25/20/18% bars, a "4.9M survivors
 * tracked" count, fabricated gap rows) are not used.
 */
export function WorkforcePublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  const snapshot = useWorkforceSnapshot();
  return isMobile
    ? <MobileWorkforcePublic signInUrl={signInUrl} verifyUrl={verifyUrl} snapshot={snapshot} />
    : <DesktopWorkforcePublic signInUrl={signInUrl} verifyUrl={verifyUrl} snapshot={snapshot} />;
}
