'use client';

import { Users, Globe, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the PeerProgrammingPublic / MobilePeerProgrammingPublic design mockups.
const BG = '#0F1117';
const COLOR = '#6EE7B7';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';
const MUTED = '#6B7280';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// The mockup shows blurred sample cohort cards behind a lock overlay. A public
// shell has no session and there is no public cohort feed, so the locked region
// renders neutral blurred placeholder cards rather than fabricated cohort rows.
function LockedCohortCard() {
  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: 10 }} />
      <div style={{ height: 10, width: '75%', borderRadius: 6, background: 'rgba(255,255,255,0.05)', marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ height: 16, width: 64, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ height: 10, width: 72, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  );
}

function DesktopPeerProgrammingPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <Users size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Peer Programming</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Finish verifying</a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Sign In</a>
          )}
        </div>
      </div>

      <div style={{ padding: '48px 64px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
          Deterministic global cohorts
        </span>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
          12-person weekly cohorts —<br /><span style={{ color: COLOR }}>you&apos;re always placed, never left out</span>
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: SUBTLE, maxWidth: 520 }}>
          Every survivor is matched into a cohort of 12. Global peers, weekly sessions, real skill-building. No competitive selection — you&apos;re guaranteed a spot.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={14} color={MUTED} />
            <span style={{ fontSize: 13, color: MUTED }}>Active cohorts across 47 countries</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.55 }} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <LockedCohortCard key={i} />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={22} color={COLOR} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to join your cohort</div>
          <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', maxWidth: 300 }}>You&apos;ll be matched automatically. First session within 48 hours.</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>{verifyUrl ? 'Finish verifying' : 'Sign in to get matched'}</a>
        </div>
      </div>
    </div>
  );
}

function MobilePeerProgrammingPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Peer Programming</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600, width: 'fit-content' }}>Deterministic global cohorts</span>
        <p style={{ margin: 0, fontSize: 14, color: SUBTLE, lineHeight: 1.5 }}>12-person weekly cohorts across 47 countries. You&apos;re always placed — no competitive selection, guaranteed spot.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Globe size={13} color={MUTED} />
          <span style={{ fontSize: 12, color: MUTED }}>Active cohorts in 47 countries</span>
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <LockedCohortCard key={i} />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={COLOR} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to get matched</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Peer Programming. Renders the public marketing
 * experience pixel-faithful to the PeerProgrammingPublic (desktop) and
 * MobilePeerProgrammingPublic (phone) design mockups, with sign-in affordances
 * pointing at the real hosted sign-in URL. It shows no private or per-user data:
 * there is no public cohort feed, so the locked region behind the sign-in overlay
 * renders neutral blurred placeholder cards rather than fabricated cohort rows.
 */
export function PeerProgrammingPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobilePeerProgrammingPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopPeerProgrammingPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
