'use client';

import { Gift, DollarSign, MessageSquare, Star, Lock, ChevronRight } from 'lucide-react';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import {
  FONT_FAMILY,
  GOAL_COLORS,
  getContributionsTokens,
  type ContributionsTokens,
} from './contributions-shared';

// The signed-out marketing view. It must show NO fabricated figures: a signed-out visitor has no
// session, so any drive name, dollar amount, count, or progress bar here would be made-up and read
// as real live data. Instead it explains the three ways a member can help, with no numbers. The real
// drive and its live totals load only after sign-in.
const WAYS_TO_HELP: Array<{ Icon: typeof DollarSign; color: string; label: string; desc: string }> = [
  { Icon: DollarSign, color: GOAL_COLORS.funding, label: 'Gift card', desc: 'Put a gift card toward the platform’s infrastructure costs.' },
  { Icon: MessageSquare, color: GOAL_COLORS.quora, label: 'Quora comment', desc: 'Share the project in a Quora comment.' },
  { Icon: Star, color: GOAL_COLORS.github, label: 'GitHub star', desc: 'Star the open-source repository.' },
];

const INTRO =
  'The platform is free and will stay that way. Members who are able can help with infrastructure costs through gift cards, a Quora comment, or a GitHub star. Every contribution is private and confirmed contributions earn ServiceCredits as a thank-you.';

function WayRow({
  label,
  desc,
  Icon,
  color,
  t,
}: {
  label: string;
  desc: string;
  Icon: typeof DollarSign;
  color: string;
  t: ContributionsTokens;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>{label}</div>
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>{desc}</div>
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
          <PublicShellBackLink />
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
          <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 14 }}>Three ways to help</div>
          {WAYS_TO_HELP.map((w) => (
            <WayRow key={w.label} {...w} t={t} />
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
          <PublicShellBackLink />
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
          <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 12 }}>Three ways to help</div>
          {WAYS_TO_HELP.map((w) => (
            <WayRow key={w.label} {...w} t={t} />
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
 * Signed-out visitor view for Contributions. Shows marketing copy, a non-numeric explainer of the
 * three ways to help, and a sign-in (or finish-verifying) call to action. It fetches no private or
 * per-user data and shows no fabricated figures — the real drive and its live totals appear only
 * after sign-in.
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
