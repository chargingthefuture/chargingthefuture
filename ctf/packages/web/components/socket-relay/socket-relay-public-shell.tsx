'use client';

import { Share2, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getSocketRelayTokens } from './sr-shared';
import { SrTargetsOnlyNotice } from './sr-targets-only-notice';

// Chrome palette comes from the shared theme tokens (getSocketRelayTokens); the plugin accent
// (t.ACCENT) is the single source of truth, so the signed-out public shell matches the signed-in
// in-app shell on every device and in every auth state. The mobile mockup had used a divergent
// red (#F43F5E); that drift is corrected by using the shared accent (#FB923C) for both layouts.
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function MobileSocketRelayPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  const COLOR = t.ACCENT;
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Share2 size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Socket Relay</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600, width: 'fit-content' }}>Peer-to-peer needs board</span>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Post what you need, offer what you have. Clothing, furniture, skills, time — the survivor community connects directly.</p>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join Skills Economy — Free'}</a>
        {/* Above the join button's fold on purpose: this is the first screen an outsider following a
            shared link or a job posting reaches, so the warning has to land before they decide to sign
            up, not after. */}
        <SrTargetsOnlyNotice />
      </div>

      {/* Blurred feed preview + lock (neutral placeholders) */}
      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => {
            const need = i % 2 === 0;
            return (
              <div key={i} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: need ? COLOR + '20' : '#22C55E20', color: need ? COLOR : '#22C55E' }}>{need ? 'NEED' : 'OFFER'}</span>
                </div>
                <div style={{ height: 13, width: '75%', borderRadius: 6, background: 'rgba(255,255,255,0.10)' }} />
                <div style={{ height: 10, width: '35%', borderRadius: 5, background: 'rgba(255,255,255,0.05)', marginTop: 8 }} />
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={COLOR} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to post and respond</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for SocketRelay. Pixel-faithful to the SocketRelayPublic
 * (desktop) and MobileSocketRelayPublic (phone) design mockups, with every sign-in
 * affordance pointing at the real hosted sign-in URL. Each breakpoint keeps its own
 * mockup accent (desktop #FB923C, phone #F43F5E).
 *
 * Real-data-only deviations from the mockup (no session = no live data): the
 * desktop mockup's banner counters (847 open requests, 12,400 fulfilled this
 * month), the sidebar stat rows (847 active requests, 12.4K fulfilled, $0 to
 * post), and every relay request/offer card (named posters like Marcus B.,
 * Amara O., James T., locations, credit amounts, timestamps) are invented sample
 * data, so the counters are dropped, the sidebar shows static "how it works" copy,
 * and the feed renders neutral blurred placeholder cards behind a sign-in lock.
 * The phone mockup's four blurred sample posts are likewise replaced with neutral
 * placeholders. The search input and category chips are read-only marketing
 * decoration; the simulated phone status bar is dropped because the real app
 * renders inside the browser chrome.
 */
export function SocketRelayPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileSocketRelayPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
