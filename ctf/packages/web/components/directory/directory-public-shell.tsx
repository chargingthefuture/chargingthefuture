'use client';

import { BookOpen, Lock, Search } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { getDirectoryTokens } from './shared';

// SkillsHunt amber from the DirectoryPublic / MobileDirectoryPublic design mockups (the
// cross-plugin reward-card accent; no shell-token slot, kept static).
const HUNT_COLOR = '#FBBF24';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function MobileDirectoryPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '20px 20px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <BookOpen size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Directory</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>Community members</span>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Therapists, housing navigators, legal advocates, and more — searchable by location and specialty.</p>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join Skills Economy — Free'}</a>
      </div>

      {/* SkillsHunt pinned reward card */}
      <div style={{ margin: '0 16px 16px', padding: '14px 16px', borderRadius: 14, background: `linear-gradient(135deg, ${HUNT_COLOR}12 0%, rgba(59,130,246,0.05) 100%)`, border: `1px solid ${HUNT_COLOR}30` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${HUNT_COLOR}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={14} style={{ color: HUNT_COLOR }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.TITLE }}>SkillsHunt</div>
        </div>
        <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.5, marginBottom: 10 }}>
          Know a survivor? Sign in to submit their public profile and help grow the Directory. Earn points &amp; badges.
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 10, background: HUNT_COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box', textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : 'Sign in to submit a profile'}
        </a>
      </div>

      {/* Sign-in gate (no fabricated preview profiles) */}
      <div style={{ flex: 1, padding: '0 16px 20px' }}>
        <div style={{ height: '100%', minHeight: 240, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to find providers</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Directory. Pixel-faithful to the DirectoryPublic
 * (desktop) and MobileDirectoryPublic (phone) design mockups, with sign-in
 * affordances pointing at the real hosted sign-in URL.
 *
 * Real-data-only deviations from the mockup (no session = no private/fabricated
 * data): the mockup's blurred preview profile cards (Maria G., James T., …), its
 * stats bar (47,000+ profiles, 68% accept credits, …), and the reward card's
 * activity counts (247 submitted this week, 63 active scouts) are all invented
 * sample data, so they are replaced with an honest sign-in gate and generic
 * marketing copy. The mockup's "Submit a community profile" modal posts to an
 * authenticated-only endpoint, so for a visitor its call to action points at the
 * sign-in URL instead of opening a form that cannot submit. The simulated phone
 * status bar is dropped because the real app renders inside the browser chrome.
 */
export function DirectoryPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileDirectoryPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
