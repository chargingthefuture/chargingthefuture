'use client';

import { Gift, DollarSign, MessageSquare, Star, Lock, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import {
  FONT_FAMILY,
  GOAL_COLORS,
  getContributionsTokens,
  type ContributionsTokens,
} from './contributions-shared';

// The signed-out marketing view. Per rule 126 it shows no private or per-user data — the drive
// figures here are a static preview of the kind of progress a drive tracks, not live totals (the
// visitor has no session to read them). The live numbers load only after sign-in.
const PREVIEW_GOALS = [
  { label: 'Funding raised', current: 1340, target: 2400, unit: '$', Icon: DollarSign, color: GOAL_COLORS.funding },
  { label: 'Quora comments', current: 87, target: 200, unit: '', Icon: MessageSquare, color: GOAL_COLORS.quora },
  { label: 'GitHub stars', current: 234, target: 500, unit: '', Icon: Star, color: GOAL_COLORS.github },
];

const INTRO =
  'The platform is free and will stay that way. Members who are able can help with infrastructure costs through gift cards, a Quora comment, or a GitHub star. Every contribution is private and confirmed contributions earn ServiceCredits as a thank-you.';

function GoalBar({
  label,
  current,
  target,
  unit,
  Icon,
  color,
  t,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  Icon: typeof DollarSign;
  color: string;
  t: ContributionsTokens;
}) {
  const pct = Math.min(Math.round((current / target) * 100), 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={12} color={color} />
          <span style={{ fontSize: 12, color: t.MUTED }}>{label}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>
          {unit}
          {current.toLocaleString()} / {unit}
          {target.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 6, background: t.BORDER_SOLID, borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function SignInButton({ signInUrl, verifyUrl, t, full }: { signInUrl: string; verifyUrl?: string; t: ContributionsTokens; full?: boolean }) {
  const href = verifyUrl ?? signInUrl;
  const label = verifyUrl ? 'Finish verifying' : 'Sign in';
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: full ? '11px' : '9px 18px',
        width: full ? '100%' : undefined,
        borderRadius: full ? 9 : 8,
        background: t.ACCENT,
        border: 'none',
        color: '#fff',
        fontSize: full ? 14 : 13,
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'none',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {label} <ChevronRight size={full ? 15 : 14} />
    </a>
  );
}

function DesktopPublic({ signInUrl, verifyUrl, t }: { signInUrl: string; verifyUrl?: string; t: ContributionsTokens }) {
  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 580, width: '100%', padding: '48px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.TITLE }}>Contributions</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Community support drive</div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.8, marginBottom: 28 }}>{INTRO}</p>

        <div style={{ background: t.SURFACE, borderRadius: 12, padding: 18, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 14 }}>Spring 2026 Infrastructure Drive</div>
          {PREVIEW_GOALS.map((g) => (
            <GoalBar key={g.label} {...g} t={t} />
          ))}
        </div>

        <div style={{ background: `${t.ACCENT}0C`, borderRadius: 12, padding: '20px 24px', border: `1px solid ${t.ACCENT}30`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${t.ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={18} color={t.ACCENT} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 4 }}>
              {verifyUrl ? 'Finish verifying to contribute' : 'Sign in to contribute'}
            </div>
            <div style={{ fontSize: 13, color: t.MUTED }}>Contributions are available to signed-in members.</div>
          </div>
          <SignInButton signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} />
        </div>
      </div>
    </div>
  );
}

function MobilePublic({ signInUrl, verifyUrl, t }: { signInUrl: string; verifyUrl?: string; t: ContributionsTokens }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.TITLE }}>Contributions</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Community support drive</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.8, margin: '0 0 22px' }}>{INTRO}</p>

        <div style={{ background: t.SURFACE, borderRadius: 12, padding: 16, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 12 }}>Spring 2026 Drive</div>
          {PREVIEW_GOALS.map((g) => (
            <GoalBar key={g.label} {...g} t={t} />
          ))}
        </div>

        <div style={{ background: `${t.ACCENT}0C`, borderRadius: 12, padding: 18, border: `1px solid ${t.ACCENT}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={16} color={t.ACCENT} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE }}>
                {verifyUrl ? 'Finish verifying to contribute' : 'Sign in to contribute'}
              </div>
              <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>Available to signed-in members</div>
            </div>
          </div>
          <SignInButton signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} full />
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Contributions, faithful to the ContributionsPublic /
 * MobileContributionsPublic mockups. Shows marketing copy, a static drive-progress preview, and a
 * sign-in (or finish-verifying) call to action. No private or per-user data is fetched.
 */
export function ContributionsPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getContributionsTokens(theme);
  return isMobile ? (
    <MobilePublic signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} />
  ) : (
    <DesktopPublic signInUrl={signInUrl} verifyUrl={verifyUrl} t={t} />
  );
}
