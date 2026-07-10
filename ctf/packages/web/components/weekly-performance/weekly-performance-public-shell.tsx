'use client';

import { BarChart2, Lock, UserPlus, LogIn } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getWeeklyPerformanceTokens } from './wp-shared';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Neutral placeholder cards shown blurred behind the sign-in lock. The mockup
// hardcoded sample figures here; a public visitor has no session, so the values
// are neutral dashes rather than fabricated numbers — the cards only hint at the
// layout that appears once signed in. The per-card colors are a data-series
// palette (one color per metric), kept raw like every chart palette.
const PLACEHOLDER_METRICS = [
  { label: 'Total Members', color: '#A78BFA' },
  { label: 'New Sign-ups', color: '#22C55E' },
  { label: 'Plugin Engagements', color: '#6366F1' },
  { label: 'GDP Delta', color: '#06B6D4' },
];

// What you get access to — static marketing copy.
const ACCESS_ITEMS = [
  { icon: '📊', t: 'Weekly metric cards', d: 'Member count, sign-ups, engagement, GDP delta' },
  { icon: '📈', t: 'Day-by-day chart', d: 'Plugin engagement compared to prior week' },
  { icon: '🗓️', t: 'Full week history', d: 'Browse closed weeks going back in time' },
  { icon: '📤', t: 'Admin export (gated)', d: 'Admins can export data as CSV' },
];

function DesktopWeeklyPerformancePublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <BarChart2 size={18} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Weekly Performance</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.BORDER, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <LogIn size={13} /> Sign In
              </a>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <UserPlus size={13} /> Join Free
              </a>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '48px 64px 32px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, fontSize: 12, color: t.ACCENT, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
            Updated weekly
          </span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>
            See how the platform grows<br />
            <span style={{ color: t.ACCENT }}>week over week</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: t.SUBTLE, maxWidth: 500, lineHeight: 1.7 }}>
            Member growth, plugin engagement, and GDP delta — all tracked weekly. Sign in to view current and historical data.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href={verifyUrl ?? signInUrl} style={{ padding: '14px 32px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              {verifyUrl ? 'Finish verifying' : 'Sign in to view metrics'}
            </a>
          </div>
        </div>
        <div style={{ width: 260, flexShrink: 0 }}>
          <div style={{ padding: '20px', borderRadius: 16, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, marginBottom: 14 }}>What you get access to</div>
            {ACCESS_ITEMS.map((item) => (
              <div key={item.t} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 2 }}>{item.t}</div>
                  <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>{item.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Placeholder metric cards + lock overlay (no fabricated figures) */}
      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ filter: 'blur(6px)', pointerEvents: 'none', opacity: 0.4 }} aria-hidden>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {PLACEHOLDER_METRICS.map(({ label, color }) => (
              <div key={label} style={{ padding: '18px 16px', borderRadius: 14, background: t.SURFACE, border: `1px solid ${color}20` }}>
                <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 10 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>—</div>
                <div style={{ fontSize: 11, color: t.MUTED, marginTop: 6 }}>—</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '20px 24px', borderRadius: 16, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, height: 120 }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${t.ACCENT}50`, background: `${t.ACCENT}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}>Sign in to view platform performance</div>
          <div style={{ fontSize: 13, color: t.MUTED, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
            Survivors can view weekly metrics. Admin accounts can additionally lock weeks and export data.
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '12px 28px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Create free account'}
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileWeeklyPerformancePublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: `${t.ACCENT}10`, borderBottom: `1px solid ${t.ACCENT}25`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PublicShellBackLink />
            <BarChart2 size={18} color={t.ACCENT} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>Weekly Performance</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {verifyUrl ? (
              <a href={verifyUrl} style={{ padding: '5px 10px', borderRadius: 6, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Finish verifying</a>
            ) : (
              <>
                <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: t.BORDER_STRONG, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
                <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Join Free</a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 8 }}>See how the platform grows</div>
        <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, marginBottom: 16 }}>
          Member growth, plugin engagement, and GDP delta — tracked week over week.
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '13px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', marginBottom: 20, textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : <><UserPlus size={15} /> Create free account</>}
        </a>
      </div>

      {/* Placeholder cards + lock overlay (no fabricated figures) */}
      <div style={{ padding: '0 16px 32px', position: 'relative' }}>
        <div style={{ filter: 'blur(5px)', pointerEvents: 'none', opacity: 0.4 }} aria-hidden>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {PLACEHOLDER_METRICS.map(({ label, color }) => (
              <div key={label} style={{ padding: '14px 12px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${color}20` }}>
                <div style={{ fontSize: 9, color: t.MUTED, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>—</div>
              </div>
            ))}
          </div>
          <div style={{ height: 90, borderRadius: 14, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${t.ACCENT}50`, background: `${t.ACCENT}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={18} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>Sign in to view metrics</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Weekly Performance. Pixel-faithful to the
 * WeeklyPerformancePublic (desktop) and MobileWeeklyPerformancePublic (phone)
 * design mockups, with every sign-in, join, and call-to-action pointing at the
 * real hosted sign-in URL.
 *
 * Real-data-only deviation (no session = no private/fabricated data): the
 * mockup hardcodes sample weekly metrics (4,912 members, 213 sign-ups, 1,847
 * engagements, +$1.2M GDP delta, "+XX vs last week"). Those numbers are
 * replaced with neutral dashes behind the same blurred lock overlay, so the
 * layout and the sign-in gate read true without showing invented figures. The
 * simulated phone status bar and the decorative locked bottom nav are dropped
 * because the real app renders inside the browser chrome.
 */
export function WeeklyPerformancePublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileWeeklyPerformancePublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopWeeklyPerformancePublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
