'use client';

import { Zap, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { PLATFORM_EARN_METHODS, PEER_TO_PEER_AREAS } from './service-credits.constants';

// Palette from the ServiceCreditsPublic / MobileServiceCreditsPublic design mockups.
const BG = '#0F1117';
const COLOR = '#A855F7';
const EARN_GREEN = '#22C55E';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// The earn/spend lists describe how the Hub economy works (program rules), not per-user balances or
// fabricated transactions, so they are safe to render in a signed-out public shell. They are derived
// from the SAME shared constants the signed-in Earn tab (sc-earn-tab.tsx) renders, so the public
// teaser can never drift from the real earn model: a few platform-funded rewards (verify your
// account, SkillsHunt, fundraiser contributions) plus peer-to-peer trading across the Hub. No
// invented amounts — each value comes straight from the shared model, and peer-to-peer spend is
// member-set, so it shows as "Variable".
const EARN_WAYS = PLATFORM_EARN_METHODS.map((m) => ({ action: m.title, credits: m.credits }));

const SPEND_WAYS = PEER_TO_PEER_AREAS.map((a) => ({ action: a.title, credits: 'Variable' }));

function DesktopServiceCreditsPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <Zap size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>ServiceCredits</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: COLOR, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Finish verifying</a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Sign In</a>
          )}
        </div>
      </div>

      <div style={{ padding: '48px 64px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
          The Survivor Hub economy
        </span>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
          Earn credits. Spend them<br /><span style={{ color: COLOR }}>on real services, for free.</span>
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: SUBTLE, maxWidth: 520 }}>
          ServiceCredits are earned from a few platform rewards and by trading with other members, and spent on housing, transport, services, and trades. They are usable across the plugins in the network.
        </p>
        <a href={verifyUrl ?? signInUrl} style={{ marginTop: 8, padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', textDecoration: 'none', display: 'inline-block' }}>
          {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
        </a>
      </div>

      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 24, filter: 'blur(3px)', pointerEvents: 'none', opacity: 0.55 }} aria-hidden="true">
          <div style={{ flex: 1, borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: EARN_GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Ways to Earn</div>
            {EARN_WAYS.map((e) => (
              <div key={e.action} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 13 }}>{e.action}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: EARN_GREEN }}>{e.credits}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Ways to Spend</div>
            {SPEND_WAYS.map((s) => (
              <div key={s.action} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 13 }}>{s.action}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLOR }}>{s.credits}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={22} color={COLOR} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to start earning credits</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: COLOR, border: 'none', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>{verifyUrl ? 'Finish verifying' : 'Sign in to earn credits'}</a>
        </div>
      </div>
    </div>
  );
}

function MobileServiceCreditsPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ flex: 1, padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Zap size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>ServiceCredits</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
          Earn credits by participating.<br /><span style={{ color: COLOR }}>Spend them on real services.</span>
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: SUBTLE, lineHeight: 1.5 }}>A few rewards come from the platform — the rest you earn by trading with other members. Use credits across housing, transport, services, and more.</p>

        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: EARN_GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Ways to Earn</div>
          {EARN_WAYS.map((e) => (
            <div key={e.action} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 13 }}>{e.action}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: EARN_GREEN }}>{e.credits}</span>
            </div>
          ))}
        </div>

        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Ways to Spend</div>
          {SPEND_WAYS.map((s) => (
            <div key={s.action} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 13 }}>{s.action}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLOR }}>{s.credits}</span>
            </div>
          ))}
        </div>

        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>{verifyUrl ? 'Finish verifying' : 'Join to start earning'}</a>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for ServiceCredits. Renders the public marketing
 * experience pixel-faithful to the ServiceCreditsPublic (desktop) and
 * MobileServiceCreditsPublic (phone) design mockups, with sign-in affordances
 * pointing at the real hosted sign-in URL. It shows no private or per-user data:
 * the earn/spend lists are static marketing copy describing the Hub economy's
 * rules, not any per-user balance or transaction history.
 */
export function ServiceCreditsPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileServiceCreditsPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopServiceCreditsPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
