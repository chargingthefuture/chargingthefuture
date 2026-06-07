'use client';

// Disputes panel: apply a dispute adjustment, moving credits from one member to another
// to resolve an open dispute case. Wired to:
//   POST /api/service-credits/admin/disputes/adjustments
// There is no list/queue endpoint for open disputes, so this is an operator-driven form
// keyed on a known dispute case ID rather than a queue. The state-changing commit is
// gated behind an explicit confirm step.
import { useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import { scAdminMutate, newIdempotencyKey, type DisputeAdjustmentResponse } from './sca-shared';

export function ServiceCreditsDisputesPanel() {
  const [disputeCaseId, setDisputeCaseId] = useState('');
  const [sourceUserId, setSourceUserId] = useState('');
  const [destinationUserId, setDestinationUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Disputes</h2>
        <p className="text-sm text-muted-foreground">
          Apply an adjustment to resolve an open dispute case by moving credits from one member to
          another. There is no automatic queue here — supply the known dispute case ID.
        </p>
      </header>

      <Feedback error={error} notice={notice} />

      <div className="grid gap-3 sm:grid-cols-2">
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
