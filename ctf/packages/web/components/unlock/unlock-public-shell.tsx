'use client';

import { Unlock as UnlockIcon, UserPlus, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the UnlockPublic / MobileUnlockPublic design mockups.
const BRAND = '#10B981';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// How verification works — static marketing copy describing the onboarding flow.
const STEPS = [
  { n: '1', icon: '📝', title: 'Create a free account', desc: 'Sign up in 60 seconds. No credit card needed.' },
  { n: '2', icon: '🔗', title: 'Submit your Quora URL', desc: 'Share your public Quora profile for identity verification.' },
  { n: '3', icon: '🔍', title: 'Admin reviews within 48h', desc: 'A human checks your profile — not an algorithm.' },
  { n: '4', icon: '🔓', title: 'Full access unlocked', desc: 'Access all apps, the marketplace, and the economy.' },
];

// Reasons survivors are asked for a public Quora profile — static marketing copy.
const REASONS = [
  { icon: '🛡', t: 'Safe community', d: 'Prevents bad actors from creating fake survivor accounts.' },
  { icon: '🔗', t: 'Proof of identity', d: "Quora history proves you're a real person online." },
  { icon: '🤝', t: 'Admin-reviewed', d: 'Every submission is reviewed by a real human, not a bot.' },
  { icon: '🌐', t: 'Public profile only', d: 'We only need your public Quora URL — no login access.' },
];

function DesktopUnlockPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <UnlockIcon size={18} color={BRAND} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Unlock Access</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '7px 16px', borderRadius: 8, background: BRAND, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                Sign In
              </a>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: BRAND, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <UserPlus size={13} /> Create Account
              </a>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '48px 64px 40px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, fontSize: 12, color: BRAND, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
            Verified access only
          </span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>
            Create your account to begin<br />
            <span style={{ color: BRAND }}>the verification process</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 520, lineHeight: 1.7 }}>
            Survivor Hub uses Quora profile verification to confirm that members are real people. This protects the community from trafficker infiltration and protects the integrity of this economy.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href={verifyUrl ?? signInUrl} style={{ padding: '14px 32px', borderRadius: 10, background: BRAND, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              {verifyUrl ? 'Finish verifying' : <><UserPlus size={16} /> Get started — it&apos;s free</>}
            </a>
          </div>
        </div>
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ padding: '20px', borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND, marginBottom: 14 }}>Why Quora verification?</div>
            {REASONS.map(({ icon, t, d }) => (
              <div key={t} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{t}</div>
                  <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Verification flow steps */}
      <div style={{ padding: '0 64px 48px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 16 }}>How verification works</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {STEPS.map(({ n, icon, title, desc }) => (
            <div key={n} style={{ flex: 1, padding: '20px', borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${BRAND}12`, border: `1px solid ${BRAND}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: BRAND }}>{n}</div>
                <span style={{ fontSize: 18 }}>{icon}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <a href={verifyUrl ?? signInUrl} style={{ padding: '14px 24px', borderRadius: 12, background: BRAND, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              {verifyUrl ? 'Finish verifying' : <>Start now <ChevronRight size={15} /></>}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileUnlockPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: `${BRAND}10`, borderBottom: `1px solid ${BRAND}25`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UnlockIcon size={16} color={BRAND} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Unlock Access</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {verifyUrl ? (
              <a href={verifyUrl} style={{ padding: '5px 10px', borderRadius: 6, background: BRAND, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Finish verifying</a>
            ) : (
              <>
                <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
                <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: BRAND, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Join Free</a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, fontSize: 11, color: BRAND, fontWeight: 600, display: 'inline-block', marginBottom: 14 }}>
          Verified access only
        </span>

        <h1 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
          Create your account to begin{' '}
          <span style={{ color: BRAND }}>the verification process</span>
        </h1>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: '#9CA3AF', lineHeight: 1.7 }}>
          Survivor Hub uses Quora profile verification to confirm members are real people. This protects the community and protects the integrity of this economy.
        </p>

        <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '14px', borderRadius: 12, background: BRAND, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', marginBottom: 20, textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : <><UserPlus size={15} /> Get started — it&apos;s free</>}
        </a>

        {/* How it works */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 12 }}>How verification works</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STEPS.map(({ n, icon, title, desc }) => (
              <div key={n} style={{ display: 'flex', gap: 12, padding: '14px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${BRAND}12`, border: `1px solid ${BRAND}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: BRAND, flexShrink: 0 }}>{n}</div>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</div>
                  <div style={{ fontSize: 11, color: SUBTLE }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why Quora mini panel */}
        <div style={{ padding: '14px', borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 12 }}>Why Quora verification?</div>
          {REASONS.slice(0, 3).map(({ icon, t, d }) => (
            <div key={t} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{t}</div>
                <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.5 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>

        <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '14px', borderRadius: 12, background: BRAND, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : <>Start verification <ChevronRight size={14} /></>}
        </a>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Unlock. Pixel-faithful to the UnlockPublic
 * (desktop) and MobileUnlockPublic (phone) design mockups, with every sign-in,
 * join, and call-to-action pointing at the real hosted sign-in URL.
 *
 * Real-data-only: the mockup is pure marketing — it describes how Quora
 * verification works and carries no per-user data, so it is reproduced as-is.
 * The simulated phone status bar and the decorative locked bottom nav are
 * dropped because the real app renders inside the browser chrome.
 */
export function UnlockPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileUnlockPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopUnlockPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
