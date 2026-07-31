'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens } from './sc-shared';

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
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const [status, setStatus] = useState<FormanceStatus | null>(null);

  useEffect(() => {
    let canceled = false;
    void fetch('/api/service-credits/admin/ledger-status', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ formance: FormanceStatus }>) : Promise.reject(new Error('status_unavailable'))))
      .then((data) => {
        if (!canceled) setStatus(data.formance);
      })
      .catch(() => {
        /* best-effort status panel */
      });
    return () => {
      canceled = true;
    };
  }, []);

  if (!status) {
    return null;
  }

  const dotColor = status.configured ? '#22C55E' : '#6B7280';

  return (
    <section
      style={{
        borderRadius: 12,
        border: `1px solid ${t.BORDER_SOLID}`,
        background: t.SURFACE,
        padding: 18,
        marginBottom: 16,
        fontSize: 13,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, margin: '0 0 8px' }}>External ledger (Formance)</h2>
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px' }}>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
        <span style={{ fontWeight: 600, color: t.TITLE }}>{status.configured ? 'Configured' : 'Not configured'}</span>
      </p>
      {status.configured ? (
        <p style={{ color: t.MUTED, margin: 0, lineHeight: 1.5 }}>
          Ledger <span style={{ fontWeight: 600, color: t.TITLE }}>{status.ledger}</span> · asset{' '}
          <span style={{ fontWeight: 600, color: t.TITLE }}>{status.asset}</span>
          {status.demoMode ? ' · demo mode' : ''}
        </p>
      ) : (
        <p style={{ color: t.MUTED, margin: 0, lineHeight: 1.5 }}>
          The external mirror is paused. Balances are authoritative in the app database and remain correct;
          ledger operations commit locally and queue for reconciliation when Formance is reconnected.
        </p>
      )}
    </section>
  );
}
