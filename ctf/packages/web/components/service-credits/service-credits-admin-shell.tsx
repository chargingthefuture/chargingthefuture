'use client';

// ServiceCredits admin surface — the money core operator dashboard. Composes the three
// action panels (governance, treasury, disputes) into one page. Admin access is enforced
// server-side by the page wrapper and by every API route; this shell only renders the
// operator controls. Mobile-responsive: panels stack on phone widths, side-by-side on
// desktop. No credits→fiat equivalence is shown anywhere.
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { ServiceCreditsGovernancePanel } from './sca-governance-panel';
import { ServiceCreditsTreasuryPanel } from './sca-treasury-panel';
import { ServiceCreditsDisputesPanel } from './sca-disputes-panel';
import { ServiceCreditsCirculationPanel } from './sca-circulation-panel';
import { ServiceCreditsCreditLimitsPanel } from './sca-credit-limits-panel';
import { ServiceCreditsWalletStatusPanel } from './sca-wallet-status-panel';
import { ServiceCreditsLedgerStatus } from './sca-ledger-status';

export function ServiceCreditsAdminShell() {
  const isMobile = useIsMobile();

  return (
    <main className={isMobile ? 'mx-auto max-w-2xl px-4 py-6 space-y-5' : 'mx-auto max-w-5xl px-6 py-10 space-y-6'}>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">ServiceCredits Admin</h1>
        <p className="text-sm text-muted-foreground">
          Governance, treasury, and dispute controls for the ServiceCredits ledger. Every action is
          written to the audit trail and asks you to confirm before it commits.
        </p>
        <p className="text-sm">
          <Link className="underline underline-offset-4" href="/apps/service-credits">
            Open the plugin shell
          </Link>
        </p>
      </header>

      <ServiceCreditsLedgerStatus />
      <ServiceCreditsCirculationPanel />
      <ServiceCreditsTreasuryPanel />
      <ServiceCreditsGovernancePanel />
      <ServiceCreditsCreditLimitsPanel />
      <ServiceCreditsWalletStatusPanel />
      <ServiceCreditsDisputesPanel />
    </main>
  );
}
