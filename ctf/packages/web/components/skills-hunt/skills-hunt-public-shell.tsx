'use client';

import { Search, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getSkillsHuntTokens } from './sh-shared';

// Palette from the SkillsHuntPublic / MobileSkillsHuntPublic design mockups, served via the
// shared theme tokens (default theme keeps the shipped hex: bg #0F1117, accent #FACC15,
// title #F9FAFB).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

const NOMINATE_FIELDS = ['First Name', 'Bio', 'Quora Profile URL', 'Skills', 'Claimed Professions'];

function MobileSkillsHuntPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${t.BORDER}` }}>
        <PublicShellBackLink />
        <Search size={20} color={t.ACCENT} />
        <span style={{ fontSize: 20, fontWeight: 800 }}>SkillsHunt</span>
      </div>

      {/* Hero */}
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>Community-powered talent scouting</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
          Help find 5M survivors<br />
          <span style={{ color: t.ACCENT }}>&amp; map their skills</span>
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: t.SUBTLE, lineHeight: 1.6 }}>
          This is not a referral button. You nominate someone you believe may be a survivor — first name, bio, Quora profile, skills, and professions. Their profile seeds the Directory so we can trade and stop depending on traffickers.
        </p>

        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join Skills Economy — Free'}</a>
      </div>

      {/* Blurred form preview + lock (neutral placeholders) */}
      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.4 }} aria-hidden="true">
          <div style={{ fontSize: 14, fontWeight: 700 }}>Nominate a Survivor</div>
          {NOMINATE_FIELDS.map((f) => (
            <div key={f}>
              <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 4 }}>{f}</div>
              <div style={{ height: 40, borderRadius: 10, background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}` }} />
            </div>
          ))}
          <div style={{ height: 46, borderRadius: 12, background: t.ACCENT + '60' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={20} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Join to start scouting</div>
          <div style={{ fontSize: 12, color: t.MUTED, textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>Survivors only. Nominate people you believe may be survivors and help build our self-sustaining economy.</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in to scout'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for SkillsHunt. Pixel-faithful to the SkillsHuntPublic
 * (desktop) and MobileSkillsHuntPublic (phone) design mockups, with every sign-in
 * affordance pointing at the real hosted sign-in URL.
 *
 * Real-data-only deviations from the mockup (no session = no private/fabricated
 * data): the mockup's hero activity counters (247 found this week, 1,482 skills
 * mapped, 63 scouts active) and the named scout leaderboard rows (Amara O.,
 * Maria G., Priya S., DeShawn W. with survivor counts) are invented sample data,
 * so the counters are dropped and the leaderboard renders neutral blurred
 * placeholder rows behind the sign-in lock. The "Nominate a Survivor" form posts
 * to an authenticated-only endpoint, so its blurred preview stays decorative and
 * its calls to action point at the sign-in URL. The simulated phone status bar is
 * dropped because the real app renders inside the browser chrome.
 */
export function SkillsHuntPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileSkillsHuntPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
