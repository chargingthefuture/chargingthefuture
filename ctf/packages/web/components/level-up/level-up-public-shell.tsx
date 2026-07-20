'use client';

import { BookOpen, CheckCircle, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getLevelUpTokens } from './lu-shared';

// Palette from the LevelUpPublic / MobileLevelUpPublic design mockups,
// served through the shared theme tokens (default theme returns the exact shipped hex).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

const HIGHLIGHTS = ['Free for all survivors', 'Earn badges and completion bonuses', 'Trainer-led cohorts'];

// Behind the lock overlay the mockup shows blurred sample cohort cards. A public
// shell has no session and there is no public cohort feed, so the locked region
// renders neutral blurred placeholder bars instead of fabricated course rows.
function LockedPlaceholderRow({ rounded }: { rounded: number }) {
  const { theme } = useTheme();
  const t = getLevelUpTokens(theme);
  return (
    <div style={{ borderRadius: rounded, border: '1px solid rgba(255,255,255,0.07)', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <div style={{ height: 12, width: '55%', borderRadius: 6, background: t.BORDER_STRONG }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <div style={{ height: 16, width: 48, borderRadius: 8, background: t.BORDER }} />
          <div style={{ height: 16, width: 40, borderRadius: 8, background: t.BORDER }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ height: 12, width: 72, borderRadius: 6, background: t.BORDER_STRONG }} />
        <div style={{ height: 10, width: 56, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  );
}

function DesktopLevelUpPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getLevelUpTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, borderBottom: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <BookOpen size={18} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>LevelUp</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Finish verifying</a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: t.BORDER_STRONG, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Sign In</a>
          )}
        </div>
      </div>

      <div style={{ padding: '48px 64px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ padding: '4px 14px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 12, color: t.ACCENT, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
          Cohort-based learning
        </span>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
          Earn skills, earn credits —<br /><span style={{ color: t.ACCENT }}>learn alongside other survivors</span>
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: t.SUBTLE, maxWidth: 520 }}>
          Cohort-based courses across tech, finance, trades, and life skills. Earn ServiceCredits through badges and completion bonuses as you progress. Trainers — survivor-advocates themselves — earn a credit split for validating your milestones.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {HIGHLIGHTS.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} color={t.ACCENT} />
              <span style={{ fontSize: 13, color: t.SUBTLE }}>{f}</span>
            </div>
          ))}
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ marginTop: 4, padding: '14px 32px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', textDecoration: 'none', display: 'inline-block' }}>
          {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
        </a>
      </div>

      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.55 }} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <LockedPlaceholderRow key={i} rounded={14} />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={22} color={t.ACCENT} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to enroll in cohorts</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>{verifyUrl ? 'Finish verifying' : 'Sign in to start learning'}</a>
        </div>
      </div>
    </div>
  );
}

function MobileLevelUpPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getLevelUpTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <BookOpen size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>LevelUp</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Cohort-based courses across tech, finance, trades, and life skills. Earn ServiceCredits through badges and completion bonuses. Trainers earn a credit split for validating your milestones.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {HIGHLIGHTS.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={13} color={t.ACCENT} />
              <span style={{ fontSize: 13, color: t.SUBTLE }}>{f}</span>
            </div>
          ))}
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <LockedPlaceholderRow key={i} rounded={12} />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to enroll</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for LevelUp. Renders the public marketing experience
 * pixel-faithful to the LevelUpPublic (desktop) and MobileLevelUpPublic (phone)
 * design mockups, with sign-in affordances pointing at the real hosted sign-in
 * URL. It shows no private or per-user data: there is no public cohort feed, so
 * the locked region behind the sign-in overlay renders neutral blurred
 * placeholders rather than the mockup's fabricated sample cohort rows.
 */
export function LevelUpPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLevelUpPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopLevelUpPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
