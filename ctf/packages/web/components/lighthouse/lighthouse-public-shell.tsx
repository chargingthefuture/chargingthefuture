'use client';

import { Home, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getLighthouseTokens } from './shared';

// Palette from the LightHousePublic / MobileLightHousePublic design mockups,
// served through the shared theme tokens (default theme returns the exact shipped hex).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// The mockup shows blurred sample listing cards behind a lock overlay. A public
// shell has no session and there is no public listing feed, so the locked region
// renders neutral blurred placeholder cards rather than fabricated listings.
function LockedListingCard({ orientation }: { orientation: 'row' | 'stacked' }) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  if (orientation === 'row') {
    return (
      <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ width: 160, height: 100, background: t.ACCENT + '15', flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '14px 18px', display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, width: '70%', borderRadius: 6, background: t.BORDER_STRONG }} />
            <div style={{ height: 10, width: '45%', borderRadius: 6, background: 'rgba(255,255,255,0.05)', marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ height: 14, width: 60, borderRadius: 6, background: t.BORDER_STRONG }} />
            <div style={{ height: 14, width: 64, borderRadius: 8, background: 'rgba(34,197,94,0.18)' }} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ height: 90, background: t.ACCENT + '15' }} />
      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ height: 12, width: '60%', borderRadius: 6, background: t.BORDER_STRONG }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <div style={{ height: 12, width: 52, borderRadius: 6, background: t.BORDER_STRONG }} />
          <div style={{ height: 10, width: 48, borderRadius: 6, background: 'rgba(34,197,94,0.18)' }} />
        </div>
      </div>
    </div>
  );
}

function DesktopLightHousePublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, borderBottom: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <Home size={18} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>LightHouse</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              Finish verifying
            </a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: t.BORDER_STRONG, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              Sign In
            </a>
          )}
        </div>
      </div>

      <div style={{ padding: '48px 64px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ padding: '4px 14px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 12, color: t.ACCENT, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
          Community housing
        </span>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
          Housing listings<br />
          <span style={{ color: t.ACCENT }}>for the survivor community</span>
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: t.SUBTLE, maxWidth: 520 }}>
          Trauma-informed hosts. ServiceCredits accepted.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '14px 32px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '14px 32px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
                Join the Hub — Free
              </a>
              <a href={signInUrl} style={{ padding: '14px 24px', borderRadius: 10, background: t.BORDER_STRONG, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
                How it works
              </a>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.55 }} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <LockedListingCard key={i} orientation="row" />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to view listings</div>
          <div style={{ fontSize: 13, color: t.MUTED, textAlign: 'center', maxWidth: 300 }}>
            Filter by price, location, availability, and Service Credit acceptance.
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
            {verifyUrl ? 'Finish verifying' : 'Sign in to browse listings'}
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileLightHousePublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Home size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>LightHouse</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>Community housing</span>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Trauma-informed hosts. ServiceCredits accepted.</p>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <LockedListingCard key={i} orientation="stacked" />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to view listings</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for LightHouse. Renders the public marketing experience
 * pixel-faithful to the LightHousePublic (desktop) and MobileLightHousePublic
 * (phone) design mockups, with sign-in affordances pointing at the real hosted
 * sign-in URL. It shows no private or per-user data: there is no public listing
 * feed, so the locked region behind the sign-in overlay renders neutral blurred
 * placeholder cards rather than the mockup's fabricated sample listings.
 */
export function LighthousePublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLightHousePublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopLightHousePublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
