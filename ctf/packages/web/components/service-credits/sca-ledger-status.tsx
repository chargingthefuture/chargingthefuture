'use client';

import { useEffect, useState } from 'react';

// Admin design tokens (shared dark admin look). ServiceCredits accent is purple #A855F7.
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

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
    <section
      style={{
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: 18,
        marginBottom: 16,
        fontSize: 13,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: '0 0 8px' }}>External ledger (Formance)</h2>
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px' }}>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
        <span style={{ fontWeight: 600, color: TEXT }}>{status.configured ? 'Configured' : 'Not configured'}</span>
      </p>
      {status.configured ? (
        <p style={{ color: SUBTLE, margin: 0, lineHeight: 1.5 }}>
          Ledger <span style={{ fontWeight: 600, color: TEXT }}>{status.ledger}</span> · asset{' '}
          <span style={{ fontWeight: 600, color: TEXT }}>{status.asset}</span>
          {status.demoMode ? ' · demo mode' : ''}
        </p>
      ) : (
        <p style={{ color: SUBTLE, margin: 0, lineHeight: 1.5 }}>
          The external mirror is paused. Balances are authoritative in the app database and remain correct;
          ledger operations commit locally and queue for reconciliation when Formance is reconnected.
        </p>
      )}
    </section>
  );
}
