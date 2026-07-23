'use client';

// Disputes panel: apply a dispute adjustment, moving credits from one member to another
// to resolve an open dispute case. Wired to:
//   GET  /api/service-credits/admin/disputes             (open disputes review list)
//   POST /api/service-credits/admin/disputes/adjustments (apply an adjustment)
// The open-disputes list (a dispute with no adjustment applied yet) lets an operator pick a case
// instead of hand-typing its ID; the state-changing commit is still gated behind an explicit confirm.
import { useCallback, useEffect, useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import { scAdminMutate, newIdempotencyKey, type DisputeAdjustmentResponse } from './sca-shared';
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens } from './sc-shared';

// One open dispute in the review list (mirrors ServiceCreditsAdminDispute from the repository).
type OpenDispute = {
  id: string;
  transferId: string;
  openedByUserId: string;
  openedByName: string | null;
  reason: string;
  createdAtIso: string;
};

function formatDisputeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function ServiceCreditsDisputesPanel() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const [disputeCaseId, setDisputeCaseId] = useState('');
  const [sourceUserId, setSourceUserId] = useState('');
  const [destinationUserId, setDestinationUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openDisputes, setOpenDisputes] = useState<OpenDispute[]>([]);

  // Best-effort: a failure leaves the list empty; the manual adjustment form still works.
  const loadOpenDisputes = useCallback(async () => {
    try {
      const res = await fetch('/api/service-credits/admin/disputes', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; disputes: OpenDispute[] };
      setOpenDisputes(data.disputes ?? []);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void loadOpenDisputes();
  }, [loadOpenDisputes]);

  const value = Number(amount);
  const ready =
    disputeCaseId.trim() && sourceUserId.trim() && destinationUserId.trim() && Number.isFinite(value) && value > 0 && reason.trim();

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await scAdminMutate<DisputeAdjustmentResponse>('/api/service-credits/admin/disputes/adjustments', 'POST', {
      disputeCaseId: disputeCaseId.trim(),
      sourceUserId: sourceUserId.trim(),
      destinationUserId: destinationUserId.trim(),
      amount: value,
      adjustmentReason: reason.trim(),
      idempotencyKey: newIdempotencyKey('dispute'),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? 'Could not apply the dispute adjustment.');
      return;
    }
    setNotice(`Adjustment applied. Adjustment ${result.data?.adjustment?.adjustmentId ?? 'recorded'}.`);
    setDisputeCaseId('');
    setSourceUserId('');
    setDestinationUserId('');
    setAmount('');
    setReason('');
    // The resolved case now has an adjustment, so it drops off the open list.
    void loadOpenDisputes();
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        borderRadius: 12,
        border: `1px solid ${t.BORDER_SOLID}`,
        background: t.SURFACE,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <header>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, margin: '0 0 4px' }}>Disputes</h2>
        <p style={{ fontSize: 13, color: t.MUTED, margin: 0, lineHeight: 1.5 }}>
          Open disputes still awaiting an adjustment are listed below. Pick one to fill the form, then
          apply an adjustment to resolve it by moving credits from one member to another.
        </p>
      </header>

      {/* Open-disputes review list: a dispute with no adjustment yet. "Resolve" pre-fills the form's
          case ID (the operator still supplies source/destination/amount). Drives the admin dot. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, margin: 0 }}>
          Open disputes {openDisputes.length > 0 ? `(${openDisputes.length})` : ''}
        </h3>
        {openDisputes.length === 0 ? (
          <p style={{ fontSize: 13, color: t.MUTED, margin: 0 }}>No open disputes.</p>
        ) : (
          openDisputes.map((dispute) => (
            <div
              key={dispute.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                background: t.BG,
                border: `1px solid ${t.BORDER_SOLID}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.TITLE, fontWeight: 600 }}>{dispute.reason}</div>
                <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>
                  Opened by {dispute.openedByName ?? `member ${dispute.openedByUserId.slice(0, 6)}`} · {formatDisputeTime(dispute.createdAtIso)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDisputeCaseId(dispute.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: `${t.ACCENT}1F`,
                  color: t.ACCENT,
                  border: `1px solid ${t.ACCENT}40`,
                  whiteSpace: 'nowrap',
                }}
              >
                Resolve
              </button>
            </div>
          ))
        )}
      </div>

      <Feedback error={error} notice={notice} />

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Field label="Dispute case ID" value={disputeCaseId} onChange={setDisputeCaseId} placeholder="dispute_…" />
        <Field label="Amount (credits)" type="number" value={amount} onChange={setAmount} placeholder="0" />
        <Field label="Source member user ID" value={sourceUserId} onChange={setSourceUserId} placeholder="user_…" />
        <Field label="Destination member user ID" value={destinationUserId} onChange={setDestinationUserId} placeholder="user_…" />
      </div>
      <Field label="Adjustment reason" value={reason} onChange={setReason} placeholder="Why this dispute is resolved this way" />

      <ConfirmAction
        label="Apply adjustment"
        busy={busy}
        disabled={!ready}
        onConfirm={() => void submit()}
        summary={
          <>
            Move <strong>{ready ? value : 0}</strong> credits from member{' '}
            <strong>{sourceUserId.trim() || '—'}</strong> to member{' '}
            <strong>{destinationUserId.trim() || '—'}</strong> to resolve dispute{' '}
            <strong>{disputeCaseId.trim() || '—'}</strong>. This changes both balances.
          </>
        }
      />
    </section>
  );
}
