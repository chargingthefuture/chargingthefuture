'use client';

import { Car, Lock, Package, Utensils } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getTrustTransportTokens, type TrustTransportTokens } from './tt-shared';

// Palette from the TrustTransportPublic / MobileTrustTransportPublic mockups, now served from
// the shared theme tokens (default theme returns the exact shipped hex values).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Built per-render from the theme tokens so the accent follows the theme; the package/food
// category colors are data-viz swatches and deliberately stay raw.
function serviceTypes(t: TrustTransportTokens) {
  return [
    { icon: Car, label: 'Rides', desc: 'Safe passenger transport', color: t.ACCENT },
    { icon: Package, label: 'Packages', desc: 'Item delivery', color: '#3B82F6' },
    { icon: Utensils, label: 'Food', desc: 'Meal delivery', color: '#22C55E' },
  ];
}

function MobileTrustTransportPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Car size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>TrustTransport</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Rides, package delivery, and food from fellow community members. Pay with ServiceCredits.</p>

        {/* Service type cards */}
        <div style={{ display: 'flex', gap: 10 }}>
          {serviceTypes(t).map(({ icon: Icon, label, color }, i) => (
            <div key={label} style={{ flex: 1, borderRadius: 12, border: `1px solid ${i === 0 ? color + '40' : 'rgba(255,255,255,0.07)'}`, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', background: i === 0 ? color + '08' : 'rgba(255,255,255,0.02)' }}>
              <Icon size={20} color={color} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      {/* Blurred driver preview + lock (neutral placeholders) */}
      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative', minHeight: 280 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          <div style={{ fontSize: 12, color: t.MUTED }}>Available drivers</div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: t.ACCENT + '25' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: 120, borderRadius: 6, background: t.BORDER_HI, marginBottom: 6 }} />
                <div style={{ height: 10, width: 60, borderRadius: 5, background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={{ height: 13, width: 44, borderRadius: 6, background: 'rgba(34,197,94,0.25)' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to book transport</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for TrustTransport. Pixel-faithful to the
 * TrustTransportPublic (desktop) and MobileTrustTransportPublic (phone) design
 * mockups, with every sign-in affordance pointing at the real hosted sign-in URL.
 *
 * Real-data-only deviations from the mockup (no session = no live data): the
 * blurred "Available drivers near you" list (Jose Martinez, Aisha Thompson,
 * David Kim with ratings, trip counts, and ETAs) is invented sample data, so it
 * renders as neutral blurred placeholder rows behind the sign-in lock. The
 * service-type cards (Rides / Packages / Food) are static marketing descriptions
 * and are kept. The simulated phone status bar is dropped because the real app
 * renders inside the browser chrome.
 */
export function TrustTransportPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileTrustTransportPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
