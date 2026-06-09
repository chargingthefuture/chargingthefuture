'use client';

import { Car, Lock, Package, Utensils } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the TrustTransportPublic / MobileTrustTransportPublic mockups.
const BG = '#0F1117';
const COLOR = '#F97316';
const TEXT = '#F9FAFB';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

const SERVICE_TYPES = [
  { icon: Car, label: 'Rides', desc: 'Safe passenger transport', color: COLOR },
  { icon: Package, label: 'Packages', desc: 'Item delivery', color: '#3B82F6' },
  { icon: Utensils, label: 'Food', desc: 'Meal delivery', color: '#22C55E' },
];

function DesktopTrustTransportPublic({ signInUrl }: { signInUrl: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <Car size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>TrustTransport</span>
        <div style={{ marginLeft: 'auto' }}>
          <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
            Sign In
          </a>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '48px 64px 32px', display: 'flex', gap: 80 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
            Safety-first transport
          </span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
            Rides, deliveries, and food —<br />
            <span style={{ color: COLOR }}>trauma-informed drivers only</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 480 }}>
            Every driver is background-checked and trauma-informed. Your pickup location is never stored permanently. Pay with Service Credits.
          </p>
          <a href={signInUrl} style={{ marginTop: 8, padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', textDecoration: 'none' }}>
            Join the Hub — Free
          </a>
        </div>

        {/* Service type preview */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {SERVICE_TYPES.map(({ icon: Icon, label, desc, color }, i) => (
            <div key={label} style={{ borderRadius: 14, border: `1px solid ${i === 0 ? color + '40' : 'rgba(255,255,255,0.07)'}`, padding: '20px 20px', background: i === 0 ? color + '08' : 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', minWidth: 110 }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Blurred driver preview + lock (neutral placeholders, no fabricated drivers) */}
      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', background: 'rgba(255,255,255,0.02)', filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#9CA3AF' }}>Available drivers near you</div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: COLOR + '25' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: 130, borderRadius: 6, background: 'rgba(255,255,255,0.10)', marginBottom: 6 }} />
                <div style={{ height: 10, width: 90, borderRadius: 5, background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={{ height: 13, width: 44, borderRadius: 6, background: 'rgba(34,197,94,0.25)' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={COLOR} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to book a safe ride</div>
          <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 300 }}>
            Schedule rides, track packages, and order food — all with trauma-informed drivers.
          </div>
          <a href={signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
            Sign in to book transport
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileTrustTransportPublic({ signInUrl }: { signInUrl: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Car size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>TrustTransport</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>Rides, package delivery, and food — all with trauma-informed, background-checked providers. Pay with Service Credits.</p>

        {/* Service type cards */}
        <div style={{ display: 'flex', gap: 10 }}>
          {SERVICE_TYPES.map(({ icon: Icon, label, color }, i) => (
            <div key={label} style={{ flex: 1, borderRadius: 12, border: `1px solid ${i === 0 ? color + '40' : 'rgba(255,255,255,0.07)'}`, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', background: i === 0 ? color + '08' : 'rgba(255,255,255,0.02)' }}>
              <Icon size={20} color={color} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
        <a href={signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>Join the Hub — Free</a>
      </div>

      {/* Blurred driver preview + lock (neutral placeholders) */}
      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative', minHeight: 280 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          <div style={{ fontSize: 12, color: '#6B7280' }}>Available drivers</div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: COLOR + '25' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: 120, borderRadius: 6, background: 'rgba(255,255,255,0.10)', marginBottom: 6 }} />
                <div style={{ height: 10, width: 60, borderRadius: 5, background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={{ height: 13, width: 44, borderRadius: 6, background: 'rgba(34,197,94,0.25)' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={COLOR} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to book transport</div>
          <a href={signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Sign in</a>
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
export function TrustTransportPublicShell({ signInUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileTrustTransportPublic signInUrl={signInUrl} /> : <DesktopTrustTransportPublic signInUrl={signInUrl} />;
}
