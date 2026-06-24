'use client';

import { BookOpen, Lock, Search, MapPin } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the DirectoryPublic / MobileDirectoryPublic design mockups.
const BG = '#0F1117';
const COLOR = '#93C5FD';
const HUNT_COLOR = '#FBBF24';
const TEXT = '#F9FAFB';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function DesktopDirectoryPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <BookOpen size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Directory</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              Sign In
            </a>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '48px 64px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600 }}>Verified profiles</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>
          Connect with verified<br />
          <span style={{ color: COLOR }}>providers &amp; advocates</span>
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 500 }}>
          Trauma-informed therapists, housing navigators, legal advocates, employment coaches, and more.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
                Join the Hub — Free
              </a>
              <a href={signInUrl} style={{ padding: '14px 24px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                Learn more
              </a>
            </>
          )}
        </div>
      </div>

      {/* SkillsHunt pinned reward card */}
      <div style={{ margin: '0 64px 28px', padding: '20px 24px', borderRadius: 16, background: `linear-gradient(135deg, ${HUNT_COLOR}12 0%, rgba(59,130,246,0.06) 100%)`, border: `1px solid ${HUNT_COLOR}30`, display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${HUNT_COLOR}20`, border: `1px solid ${HUNT_COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Search size={22} style={{ color: HUNT_COLOR }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>SkillsHunt — Community Reward</div>
          </div>
          <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5 }}>
            Know a survivor with skills the community needs? Sign in to submit their public profile and help grow the Directory. Earn points, badges, and prizes.
          </div>
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '12px 22px', borderRadius: 12, background: HUNT_COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : 'Sign in to submit a profile'}
        </a>
      </div>

      {/* Sign-in gate (no fabricated preview profiles) */}
      <div style={{ padding: '0 64px 64px' }}>
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={24} color={COLOR} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, textAlign: 'center' }}>Sign in to browse the Directory</div>
          <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 320, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={13} color="#6B7280" /> Filter by specialty, location, and Service Credit acceptance.
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '12px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Sign in to connect'}
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileDirectoryPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ padding: '20px 20px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Directory</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600, width: 'fit-content' }}>Verified profiles</span>
        <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>Therapists, housing navigators, legal advocates, and more — searchable by location and specialty.</p>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      {/* SkillsHunt pinned reward card */}
      <div style={{ margin: '0 16px 16px', padding: '14px 16px', borderRadius: 14, background: `linear-gradient(135deg, ${HUNT_COLOR}12 0%, rgba(59,130,246,0.05) 100%)`, border: `1px solid ${HUNT_COLOR}30` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${HUNT_COLOR}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={14} style={{ color: HUNT_COLOR }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>SkillsHunt</div>
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 10 }}>
          Know a survivor? Sign in to submit their public profile and help grow the Directory. Earn points &amp; badges.
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 10, background: HUNT_COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box', textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : 'Sign in to submit a profile'}
        </a>
      </div>

      {/* Sign-in gate (no fabricated preview profiles) */}
      <div style={{ flex: 1, padding: '0 16px 20px' }}>
        <div style={{ height: '100%', minHeight: 240, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={COLOR} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to find providers</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
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
  const isMobile = useIsMobile();
  return isMobile ? <MobileDirectoryPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopDirectoryPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
