'use client';

import { BookOpen, CheckCircle, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getSkillUpTokens } from './su-shared';

// Palette from the SkillUpPublic / MobileSkillUpPublic design mockups,
// served through the shared theme tokens (default theme returns the exact shipped hex).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

const HIGHLIGHTS = ['Free for all survivors', 'Earn badges and completion bonuses', 'Trainer-led cohorts'];

// Behind the lock overlay the mockup shows blurred sample cohort cards. A public
// shell has no session and there is no public cohort feed, so the locked region
// renders neutral blurred placeholder bars instead of fabricated course rows.
function LockedPlaceholderRow({ rounded }: { rounded: number }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
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

function MobileSkillUpPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <BookOpen size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>SkillUp</span>
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
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>{verifyUrl ? 'Finish verifying' : 'Join Skills Economy — Free'}</a>
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
 * Signed-out visitor view for SkillUp. Renders the public marketing experience
 * pixel-faithful to the SkillUpPublic (desktop) and MobileSkillUpPublic (phone)
 * design mockups, with sign-in affordances pointing at the real hosted sign-in
 * URL. It shows no private or per-user data: there is no public cohort feed, so
 * the locked region behind the sign-in overlay renders neutral blurred
 * placeholders rather than the mockup's fabricated sample cohort rows.
 */
export function SkillUpPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileSkillUpPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
