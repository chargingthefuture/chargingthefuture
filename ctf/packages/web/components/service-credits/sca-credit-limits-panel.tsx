'use client';

// Credit-limits panel: set a member's mutual-credit limit. The line is flat and equal by default
// (the policy default applies to everyone); a per-account override is used only when needed — set to
// 0 to revoke. No behavioural score. State-changing money operation, so the commit is gated behind an
// explicit confirm step. Also offers a read-only look-up. Wired to:
//   GET  /api/service-credits/admin/credit-limits?targetUserId=<id>
//   POST /api/service-credits/admin/credit-limits  <- { targetUserId, creditLimit }
import { useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import { scAdminMutate, type CreditLimitResponse, type CreditLimitLookup } from './sca-shared';

export function ServiceCreditsCreditLimitsPanel() {
  const [targetUserId, setTargetUserId] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookup, setLookup] = useState<CreditLimitLookup | null>(null);

  const limit = Number(creditLimit);
  const ready = targetUserId.trim() && creditLimit.length > 0 && Number.isFinite(limit) && limit >= 0;

  async function lookUp() {
    const id = targetUserId.trim();
    if (!id) return;
    setLookingUp(true);
    setError(null);
    setNotice(null);
    setLookup(null);
    try {
      const res = await fetch(
        `/api/service-credits/admin/credit-limits?targetUserId=${encodeURIComponent(id)}`,
      );
      const data = (await res.json().catch(() => null)) as CreditLimitResponse & {
        creditLimit?: CreditLimitLookup;
        message?: string;
      };
      if (!res.ok || !data?.ok || !data.creditLimit) {
        setError(data?.message ?? 'Could not look up this member.');
        return;
      }
      setLookup(data.creditLimit as CreditLimitLookup);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLookingUp(false);
    }
  }

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
    setLookup(null);
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

      <div className="space-y-2">
        <button
          type="button"
          disabled={!targetUserId.trim() || lookingUp}
          onClick={() => void lookUp()}
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {lookingUp ? 'Looking up…' : 'Look up'}
        </button>
        {lookup ? (
          <dl className="grid gap-x-6 gap-y-1 rounded-md border bg-background p-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">Mutual-credit limit</dt>
              <dd className="font-semibold">{lookup.creditLimit}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">Source</dt>
              <dd className="font-semibold">{lookup.isDefault ? 'Policy default' : 'Per-account'}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">Frozen</dt>
              <dd className="font-semibold">{lookup.frozen ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Every member gets the same flat limit by default. Override per account only when needed; set to 0 to revoke.
        </p>
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
