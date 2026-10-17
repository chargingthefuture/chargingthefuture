'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens } from './sc-shared';
import { Feedback } from './sca-fields';
import { failureText, responseFailureText } from 'lib/errors/client-failure';

type FormanceStatus = {
  configured: boolean;
  apiUrlSet: boolean;
  ledger: string | null;
  asset: string;
  demoMode: boolean;
};

// Movements written to the app's ledger but not yet copied to Formance (issue #2907). An hourly job
// re-sends them; this says how many are waiting and since when.
type ReplayQueue = { queued: number; oldestQueuedAtIso: string | null };

function queueLine(queue: ReplayQueue | null): string | null {
  if (!queue) return null;
  if (queue.queued === 0) return 'Every credit movement has been copied to Formance.';
  const since = queue.oldestQueuedAtIso ? ` The oldest has waited since ${new Date(queue.oldestQueuedAtIso).toLocaleString()}.` : '';
  const noun = queue.queued === 1 ? 'credit movement is' : 'credit movements are';
  return `${queue.queued} ${noun} waiting to be copied to Formance. An hourly job re-sends them.${since}`;
}

// Read-only status of the external ledger (Formance) so the operator can see, from this page,
// whether the mirror is wired up. Balances are authoritative in the app database; Formance is the
// external mirror, so "not configured" is safe — operations still commit locally and queue for
// reconciliation. A failed read shows its reason in the card rather than hiding it, so the operator
// can tell "the status route failed" from "nothing to show".
export function ServiceCreditsLedgerStatus() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const [status, setStatus] = useState<FormanceStatus | null>(null);
  const [queue, setQueue] = useState<ReplayQueue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      try {
        const res = await fetch('/api/service-credits/admin/ledger-status', { cache: 'no-store' });
        if (!res.ok) {
          const text = await responseFailureText(res, 'The external ledger status could not be loaded.');
          if (!canceled) setLoadError(text);
          return;
        }
        const data = (await res.json()) as { formance: FormanceStatus; queue?: ReplayQueue };
        if (!canceled) {
          setStatus(data.formance);
          setQueue(data.queue ?? null);
        }
      } catch (caught) {
        const text = failureText(caught, {
          area: 'service-credits',
          op: 'admin_ledger_status_load',
          fallback: 'The external ledger status could not be loaded.',
        });
        if (!canceled) setLoadError(text);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  if (!status) {
    if (!loadError) {
      return null;
    }
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
        <Feedback error={loadError} notice={null} />
      </section>
    );
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
      {queueLine(queue) ? <p style={{ color: t.MUTED, margin: '6px 0 0', lineHeight: 1.5 }}>{queueLine(queue)}</p> : null}
    </section>
  );
}
