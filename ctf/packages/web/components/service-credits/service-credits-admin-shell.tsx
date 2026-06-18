'use client';

// ServiceCredits admin surface — the money core operator dashboard. Composes the action
// panels (ledger status, circulation, treasury, governance, credit limits, wallet status,
// disputes) into one page. Admin access is enforced server-side by the page wrapper and by
// every API route; this shell only renders the operator controls. Dark admin design system
// (rule 131): single centered responsive column. No credits→fiat equivalence is shown anywhere.
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { ServiceCreditsGovernancePanel } from './sca-governance-panel';
import { ServiceCreditsTreasuryPanel } from './sca-treasury-panel';
import { ServiceCreditsDisputesPanel } from './sca-disputes-panel';
import { ServiceCreditsCirculationPanel } from './sca-circulation-panel';
import { ServiceCreditsCreditLimitsPanel } from './sca-credit-limits-panel';
import { ServiceCreditsWalletStatusPanel } from './sca-wallet-status-panel';
import { ServiceCreditsLedgerStatus } from './sca-ledger-status';

// Admin design tokens (shared dark admin look). ServiceCredits accent is purple #A855F7.
const COLOR = '#A855F7';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

export function ServiceCreditsAdminShell() {
  return (
    <main style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 12,
            background: PANEL,
            border: `1px solid ${BORDER}`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: `${COLOR}20`,
              border: `1px solid ${COLOR}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Coins size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>ServiceCredits Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Governance, treasury &amp; disputes</div>
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

        <p style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6, margin: '0 0 8px' }}>
          Governance, treasury, and dispute controls for the ServiceCredits ledger. Every action is
          written to the audit trail and asks you to confirm before it commits.
        </p>
        <p style={{ fontSize: 13, margin: '0 0 16px' }}>
          <Link href="/apps/service-credits" style={{ color: COLOR, textDecoration: 'none', fontWeight: 600 }}>
            Open the plugin shell
          </Link>
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
