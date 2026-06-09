'use client';

import {
  Globe, BarChart2, MapPin, LogIn, UserPlus, ShieldCheck, Lock, Plus, TrendingUp,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the GDPPublic / MobileGDPPublic design mockups.
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const COLOR = '#06B6D4';
const ACCENT = '#7C3AED';
const ACCENT_CYAN = '#0EA5E9';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function DesktopGDPPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, overflow: 'hidden' }}>
      {/* Marketing banner */}
      <div style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_CYAN} 100%)`, padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Globe size={15} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Survivor Hub GDP Tracker · The economic output of the survivor community · Public read-only</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '6px 16px', borderRadius: 7, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '6px 16px', borderRadius: 7, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <LogIn size={13} /> Sign In
              </a>
              <a href={signInUrl} style={{ padding: '6px 16px', borderRadius: 7, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <UserPlus size={13} /> Add Your Skills →
              </a>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <aside style={{ width: 280, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Globe size={16} color={COLOR} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>GDP Dashboard</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, background: `${COLOR}18`, color: COLOR, border: `1px solid ${COLOR}30`, borderRadius: 4, padding: '2px 7px' }}>Public</span>
            </div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Read-only · Sign in to contribute your skills</div>
          </div>

          <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
            {/* Hero stat — locked until sign-in (no fabricated totals) */}
            <div style={{ borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}25`, padding: '20px 16px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: SUBTLE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>TI Skills Economy</div>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Lock size={18} color={COLOR} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>Economy totals are coming soon</div>
              <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5 }}>Live totals appear here as verified members add their skills. Sign in to contribute.</div>
            </div>

            {[
              { label: 'Active Members', icon: Globe },
              { label: 'Countries', icon: Globe },
              { label: 'Monthly Growth', icon: TrendingUp },
            ].map(({ label, icon: Icon }) => (
              <div key={label} style={{ borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE, padding: '12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={SUBTLE} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: SUBTLE }}>—</div>
                  <div style={{ fontSize: 11, color: SUBTLE }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Trafficking-Informed Skills Economy</div>
              <div style={{ fontSize: 13, color: SUBTLE }}>Economic output of the survivor community · Public dashboard</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: SURFACE, border: `1px solid ${BORDER}` }}>
                <ShieldCheck size={12} color={ACCENT_CYAN} />
                <span style={{ fontSize: 12, color: ACCENT_CYAN }}>Survivor Verified</span>
              </div>
              <div style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 13, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={12} /> <Plus size={12} /> Add Skills
              </div>
            </div>
          </div>

          {/* Sector breakdown — locked until sign-in (no fabricated figures) */}
          <div style={{ borderRadius: 16, border: `1px solid ${BORDER}`, background: SURFACE, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Sector Breakdown</div>
              <BarChart2 size={16} color={SUBTLE} />
            </div>
            <div style={{ borderRadius: 10, border: `1px dashed ${BORDER}`, padding: '28px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>No sector data to show yet</div>
              <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5 }}>Sector totals build up as verified members add their skills.</div>
            </div>
          </div>

          {/* Top countries — locked until sign-in (no fabricated figures) */}
          <div style={{ borderRadius: 16, border: `1px solid ${BORDER}`, background: SURFACE, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={15} color={COLOR} /> Top Countries by Economic Output
            </div>
            <div style={{ borderRadius: 10, border: `1px dashed ${BORDER}`, padding: '28px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>Country rankings are coming soon</div>
              <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5 }}>Rankings appear here once enough members have contributed.</div>
            </div>
          </div>

          {/* Auth gate CTA */}
          <div style={{ borderRadius: 16, border: `2px solid ${COLOR}30`, background: `${COLOR}06`, padding: '28px 32px', textAlign: 'center' }}>
            <Globe size={32} color={`${COLOR}60`} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Add your skills to the economy</div>
            <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.6, maxWidth: 480, margin: '0 auto 20px' }}>
              Every verified skill you add increases the collective value of the TI Skills Economy. Create a free account to contribute, earn Service Credits, and appear on the global map.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {verifyUrl ? (
                <a href={verifyUrl} style={{ padding: '11px 28px', borderRadius: 10, background: COLOR, border: 'none', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
                  Finish verifying
                </a>
              ) : (
                <a href={signInUrl} style={{ padding: '11px 28px', borderRadius: 10, background: COLOR, border: 'none', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
                  <UserPlus size={15} style={{ display: 'inline', marginRight: 7 }} /> Add Your Skills Free
                </a>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MobileGDPPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>GDP</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600, width: 'fit-content' }}>Survivor economy dashboard</span>
        <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>The gross domestic product of the survivor economy — economic activity, skill gaps, and contributor rankings.</p>

        {/* Live snapshot — locked until sign-in (no fabricated totals) */}
        <div style={{ borderRadius: 16, border: `1px solid ${COLOR}30`, background: COLOR + '06', padding: '20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={18} color={COLOR} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Economy totals are coming soon</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>Live totals build up as verified members add their skills. Sign in to contribute.</div>
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px' }}>
        <div style={{ height: '100%', minHeight: 200, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={COLOR} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>Sign in for contributor rankings</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: COLOR, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for GDP. Pixel-faithful to the GDPPublic (desktop) and
 * MobileGDPPublic (phone) design mockups, with sign-in affordances pointing at
 * the real hosted sign-in URL.
 *
 * Real-data-only deviation (no session = no private/fabricated data): the
 * mockup hardcodes economic figures (a $247B / $2.4B headline total, 4.9M
 * members, sector breakdown percentages, a top-countries table with invented
 * GDP and member counts). Those are sample data, so every figure is replaced
 * with an honest "coming soon" empty state while the layout, section labels, and
 * marketing copy are kept. The simulated phone status bar is dropped because the
 * real app renders inside the browser chrome.
 */
export function GdpPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileGDPPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopGDPPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
