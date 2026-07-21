'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Lock } from 'lucide-react';
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
  const snapshot = useWorkforceSnapshot();
  return <MobileWorkforcePublic signInUrl={signInUrl} verifyUrl={verifyUrl} snapshot={snapshot} />;
}
