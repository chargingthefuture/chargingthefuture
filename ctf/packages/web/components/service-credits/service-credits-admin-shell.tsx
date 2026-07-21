'use client';

// ServiceCredits admin surface — the money core operator dashboard. Composes the action
// panels (ledger status, circulation, treasury, governance, credit limits, wallet status,
// disputes) into one page. Admin access is enforced server-side by the page wrapper and by
// every API route; this shell only renders the operator controls. Dark admin design system
// (rule 131): single centered responsive column. No credits→fiat equivalence is shown anywhere.
import { Coins } from 'lucide-react';
import { ServiceCreditsGovernancePanel } from './sca-governance-panel';
import { ServiceCreditsTreasuryPanel } from './sca-treasury-panel';
import { ServiceCreditsDisputesPanel } from './sca-disputes-panel';
import { ServiceCreditsCirculationPanel } from './sca-circulation-panel';
import { ServiceCreditsCreditLimitsPanel } from './sca-credit-limits-panel';
import { ServiceCreditsWalletStatusPanel } from './sca-wallet-status-panel';
import { ServiceCreditsLedgerStatus } from './sca-ledger-status';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens } from './sc-shared';

export function ServiceCreditsAdminShell() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  return (
    <main
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped and unreachable. On mobile the document
        // scrolls, so only set a min-height there. Matches the unlock / skills-hunt admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="ServiceCredits Admin" accent={t.ACCENT} icon={<Coins size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/service-credits" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 12,
            background: t.HEADER,
            border: `1px solid ${t.BORDER_SOLID}`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: `${t.ACCENT}20`,
              border: `1px solid ${t.ACCENT}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Coins size={18} color={t.ACCENT} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>ServiceCredits Admin</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Governance, treasury &amp; disputes</div>
          </div>
          <span
            style={{
              marginLeft: 'auto',
              padding: '3px 9px',
              borderRadius: 6,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              fontSize: 11,
              color: '#6366F1',
              fontWeight: 700,
            }}
          >
            ADMIN
          </span>
        </div>

        <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, margin: '0 0 8px' }}>
          Governance, treasury, and dispute controls for the ServiceCredits ledger. Every action is
          written to the audit trail and asks you to confirm before it commits.
        </p>

        <ServiceCreditsLedgerStatus />
        <ServiceCreditsCirculationPanel />
        <ServiceCreditsTreasuryPanel />
        <ServiceCreditsGovernancePanel />
        <ServiceCreditsCreditLimitsPanel />
        <ServiceCreditsWalletStatusPanel />
        <ServiceCreditsDisputesPanel />
      </div>
    </main>
  );
}
