'use client';

import { BookOpen, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { getDirectoryTokens } from './shared';
import { PublicShellWorldwide } from '@/components/plugins/public-shell-worldwide';

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
        <PublicShellWorldwide color={t.MUTED} />
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join Skills Economy — Free'}</a>
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
 * and stats bar (47,000+ profiles, 68% accept credits, …) are invented sample
 * data, so they are replaced with an honest sign-in gate. The mockup's SkillsHunt
 * reward card is left out: a newcomer gets one ask (join) rather than two. The
 * simulated phone status bar is dropped because the real app renders inside the
 * browser chrome.
 */
export function DirectoryPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileDirectoryPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
