'use client';

import { Users, Globe, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getPeerProgrammingTokens } from './pp-shared';

// Palette from the PeerProgrammingPublic / MobilePeerProgrammingPublic design mockups,
// served through the shared theme tokens (default theme returns the exact shipped hex).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// The mockup shows blurred sample cohort cards behind a lock overlay. A public
// shell has no session and there is no public cohort feed, so the locked region
// renders neutral blurred placeholder cards rather than fabricated cohort rows.
function LockedCohortCard() {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ height: 12, width: '60%', borderRadius: 6, background: t.BORDER_STRONG, marginBottom: 10 }} />
      <div style={{ height: 10, width: '75%', borderRadius: 6, background: 'rgba(255,255,255,0.05)', marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ height: 16, width: 64, borderRadius: 8, background: t.BORDER }} />
        <div style={{ height: 10, width: 72, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  );
}

function MobilePeerProgrammingPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Users size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>PeerProgramming</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>Deterministic global cohorts</span>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Weekly cohorts of up to 12 people, open worldwide. Active members are placed automatically each week — no competitive selection.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Globe size={13} color={t.MUTED} />
          <span style={{ fontSize: 12, color: t.MUTED }}>Open to members worldwide</span>
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>{verifyUrl ? 'Finish verifying' : 'Join Skills Economy — Free'}</a>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <LockedCohortCard key={i} />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to get matched</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for PeerProgramming. Renders the public marketing
 * experience pixel-faithful to the PeerProgrammingPublic (desktop) and
 * MobilePeerProgrammingPublic (phone) design mockups, with sign-in affordances
 * pointing at the real hosted sign-in URL. It shows no private or per-user data:
 * there is no public cohort feed, so the locked region behind the sign-in overlay
 * renders neutral blurred placeholder cards rather than fabricated cohort rows.
 */
export function PeerProgrammingPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobilePeerProgrammingPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
