'use client';

import { useEffect, useState } from 'react';

type FormanceStatus = {
  configured: boolean;
  apiUrlSet: boolean;
  ledger: string | null;
  asset: string;
  demoMode: boolean;
};

// Read-only status of the external ledger (Formance) so the operator can see, from this page,
// whether the mirror is wired up. Balances are authoritative in the app database; Formance is the
// external mirror, so "not configured" is safe — operations still commit locally and queue for
// reconciliation. Best-effort: a failed fetch just hides the panel.
export function ServiceCreditsLedgerStatus() {
  const [status, setStatus] = useState<FormanceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/service-credits/admin/ledger-status', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ formance: FormanceStatus }>) : Promise.reject(new Error('status_unavailable'))))
      .then((data) => {
        if (!cancelled) setStatus(data.formance);
      })
      .catch(() => {
        /* best-effort status panel */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) {
    return null;
  }

  const dotColor = status.configured ? '#22C55E' : '#6B7280';

  return (
    <section className="rounded-lg border bg-card p-5 text-sm space-y-2">
      <h2 className="text-lg font-medium">External ledger (Formance)</h2>
      <p className="flex items-center gap-2">
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
        <span className="font-medium">{status.configured ? 'Configured' : 'Not configured'}</span>
      </p>
      {status.configured ? (
        <p className="text-muted-foreground">
          Ledger <span className="font-medium text-foreground">{status.ledger}</span> · asset{' '}
          <span className="font-medium text-foreground">{status.asset}</span>
          {status.demoMode ? ' · demo mode' : ''}
        </p>
      ) : (
        <p className="text-muted-foreground">
          The external mirror is paused. Balances are authoritative in the app database and remain correct;
          ledger operations commit locally and queue for reconciliation when Formance is reconnected.
        </p>
      )}
    </section>
  );
}
