'use client';

import { Zap } from 'lucide-react';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { PLATFORM_EARN_METHODS, PEER_TO_PEER_AREAS } from './service-credits.constants';
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens } from './sc-shared';

// Palette from the ServiceCreditsPublic / MobileServiceCreditsPublic design mockups.
// Chrome colors come from getServiceCreditsTokens; the earn green stays a raw status swatch.
const EARN_GREEN = '#22C55E';
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

function MobileServiceCreditsPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ flex: 1, padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <Zap size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>ServiceCredits</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
          Earn credits by participating.<br /><span style={{ color: t.ACCENT }}>Spend them on real services.</span>
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>A few rewards come from the platform — the rest you earn by trading with other members. Use credits across housing, transport, services, and more.</p>

        <div style={{ borderRadius: 14, border: `1px solid ${t.BORDER_STRONG}`, padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: EARN_GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Ways to Earn</div>
          {EARN_WAYS.map((e) => (
            <div key={e.action} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 13 }}>{e.action}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: EARN_GREEN }}>{e.credits}</span>
            </div>
          ))}
        </div>

        <div style={{ borderRadius: 14, border: `1px solid ${t.BORDER_STRONG}`, padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Ways to Spend</div>
          {SPEND_WAYS.map((s) => (
            <div key={s.action} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 13 }}>{s.action}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT }}>{s.credits}</span>
            </div>
          ))}
        </div>

        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>{verifyUrl ? 'Finish verifying' : 'Join to start earning'}</a>
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
  return <MobileServiceCreditsPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
