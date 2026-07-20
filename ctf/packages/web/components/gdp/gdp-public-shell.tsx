'use client';

import {
  Globe, BarChart2, MapPin, LogIn, UserPlus, ShieldCheck, Lock, Plus, TrendingUp,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { useTheme } from '@/hooks/useTheme';
import { getGdpTokens } from './gdp-shared';

// Marketing-banner gradient colors from the GDPPublic design mockup (no theme token equivalent).
const ACCENT = '#7C3AED';
const ACCENT_CYAN = '#0EA5E9';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function DesktopGDPPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, overflow: 'hidden' }}>
      {/* Marketing banner */}
      <div style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_CYAN} 100%)`, padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PublicShellBackLink />
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
        <aside style={{ width: 280, borderRight: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Globe size={16} color={t.ACCENT} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>GDP Dashboard</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, background: `${t.ACCENT}18`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30`, borderRadius: 4, padding: '2px 7px' }}>Public</span>
            </div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Read-only · Sign in to contribute your skills</div>
          </div>

          <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
            {/* Hero stat — locked until sign-in (no fabricated totals) */}
            <div style={{ borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}25`, padding: '20px 16px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>TI Skills Economy</div>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Lock size={18} color={t.ACCENT} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 4 }}>Economy totals are coming soon</div>
              <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>Live totals build up as members exchange value in the community — credits sent, calls paid, favors completed. Sign in to contribute.</div>
            </div>

            {[
              { label: 'Members', icon: Globe },
              { label: 'Countries', icon: Globe },
              { label: 'Community Value', icon: TrendingUp },
            ].map(({ label, icon: Icon }) => (
              <div key={label} style={{ borderRadius: 10, border: `1px solid ${t.BORDER_SOLID}`, background: t.SURFACE, padding: '12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={t.MUTED} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.MUTED }}>—</div>
                  <div style={{ fontSize: 11, color: t.MUTED }}>{label}</div>
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
              <div style={{ fontSize: 13, color: t.MUTED }}>Economic output of the survivor community · Public dashboard</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                <ShieldCheck size={12} color={ACCENT_CYAN} />
                <span style={{ fontSize: 12, color: ACCENT_CYAN }}>Survivor Verified</span>
              </div>
              <div style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={12} /> <Plus size={12} /> Add Skills
              </div>
            </div>
          </div>

          {/* Sector breakdown — locked until sign-in (no fabricated figures) */}
          <div style={{ borderRadius: 16, border: `1px solid ${t.BORDER_SOLID}`, background: t.SURFACE, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Value by Source</div>
              <BarChart2 size={16} color={t.MUTED} />
            </div>
            <div style={{ borderRadius: 10, border: `1px dashed ${t.BORDER_SOLID}`, padding: '28px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 4 }}>No value data to show yet</div>
              <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>Value builds up as members exchange value across the apps.</div>
            </div>
          </div>

          {/* Top countries — locked until sign-in (no fabricated figures) */}
          <div style={{ borderRadius: 16, border: `1px solid ${t.BORDER_SOLID}`, background: t.SURFACE, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={15} color={t.ACCENT} /> Members by Country
            </div>
            <div style={{ borderRadius: 10, border: `1px dashed ${t.BORDER_SOLID}`, padding: '28px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 4 }}>The country breakdown is coming soon</div>
              <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>Members by country appear here as members add their location.</div>
            </div>
          </div>

          {/* Auth gate CTA */}
          <div style={{ borderRadius: 16, border: `2px solid ${t.ACCENT}30`, background: `${t.ACCENT}06`, padding: '28px 32px', textAlign: 'center' }}>
            <Globe size={32} color={`${t.ACCENT}60`} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Add your skills to the economy</div>
            <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.6, maxWidth: 480, margin: '0 auto 20px' }}>
              Create a free account to join the directory, earn ServiceCredits, and take part in the exchanges that build the survivor economy.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {verifyUrl ? (
                <a href={verifyUrl} style={{ padding: '11px 28px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
                  Finish verifying
                </a>
              ) : (
                <a href={signInUrl} style={{ padding: '11px 28px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
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
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <TrendingUp size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>GDP</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>Survivor economy dashboard</span>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>The gross domestic product of the survivor economy — the total value the community creates, broken down by where it comes from, plus how many members are in each country.</p>

        {/* Live snapshot — locked until sign-in (no fabricated totals) */}
        <div style={{ borderRadius: 16, border: `1px solid ${t.ACCENT}30`, background: t.ACCENT + '06', padding: '20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={18} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>Economy totals are coming soon</div>
          <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.5 }}>Live totals build up as members exchange value in the community — credits sent, calls paid, favors completed. Sign in to contribute.</div>
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px' }}>
        <div style={{ height: '100%', minHeight: 200, borderRadius: 12, border: `1px solid ${t.BORDER}`, background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.ACCENT + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>Sign in to see the full breakdown</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
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
