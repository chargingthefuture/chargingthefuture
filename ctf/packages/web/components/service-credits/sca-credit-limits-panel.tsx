'use client';

// Credit-limits panel: grant or revoke a member's mutual-credit limit — the only way a member
// gains the ability to go negative. New accounts default to 0. State-changing money operation,
// so the commit is gated behind an explicit confirm step. Wired to:
//   POST /api/service-credits/admin/credit-limits  <- { targetUserId, creditLimit }
import { useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import { scAdminMutate, type CreditLimitResponse } from './sca-shared';

export function ServiceCreditsCreditLimitsPanel() {
  const [targetUserId, setTargetUserId] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const limit = Number(creditLimit);
  const ready = targetUserId.trim() && creditLimit.length > 0 && Number.isFinite(limit) && limit >= 0;

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await scAdminMutate<CreditLimitResponse>('/api/service-credits/admin/credit-limits', 'POST', {
      targetUserId: targetUserId.trim(),
      creditLimit: limit,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? 'Could not set the mutual-credit limit.');
      return;
    }
    setNotice(`Set ${targetUserId.trim()}'s mutual-credit limit to ${limit} ServiceCredits.`);
    setTargetUserId('');
    setCreditLimit('');
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Mutual-credit limits</h2>
        <p className="text-sm text-muted-foreground">
          New accounts start at 0. Raise a limit only for trusted members; set to 0 to revoke.
        </p>
      </header>

      <Feedback error={error} notice={notice} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Member user ID" value={targetUserId} onChange={setTargetUserId} placeholder="user_…" />
        <Field label="Credit limit (ServiceCredits)" type="number" value={creditLimit} onChange={setCreditLimit} placeholder="0" />
      </div>

      <ConfirmAction
        label="Set limit"
        busy={busy}
        disabled={!ready}
        onConfirm={() => void submit()}
        summary={
          <>
            Set <strong>{targetUserId.trim() || '—'}</strong>&apos;s mutual-credit limit to{' '}
            <strong>{ready ? limit : 0}</strong> ServiceCredits.
          </>
        }
      />
    </section>
  );
}
