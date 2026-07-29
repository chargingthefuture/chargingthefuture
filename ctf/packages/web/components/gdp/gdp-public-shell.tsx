'use client';

import { Lock, TrendingUp } from 'lucide-react';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { useTheme } from '@/hooks/useTheme';
import { getGdpTokens } from './gdp-shared';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

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
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join Skills Economy — Free'}</a>
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
  return <MobileGDPPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
