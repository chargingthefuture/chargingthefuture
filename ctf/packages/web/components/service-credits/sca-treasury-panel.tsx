'use client';

// Treasury panel: read and update the treasury policy config, and collect a fee from a
// member into the treasury wallet. Wired to:
//   GET  /api/service-credits/admin/treasury            -> { ok, treasuryConfig }
//   PUT  /api/service-credits/admin/treasury            <- { policy: {...} }
//   POST /api/service-credits/admin/treasury/fees/collect
// The policy is an open-ended JSON object the server stores verbatim, so it is edited as
// JSON text and validated client-side before the confirm step.
import { useCallback, useEffect, useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import {
  scAdminMutate,
  newIdempotencyKey,
  type TreasuryConfigResponse,
  type TreasuryFeeResponse,
} from './sca-shared';

export function ServiceCreditsTreasuryPanel() {
  const [loading, setLoading] = useState(true);
  const [policyText, setPolicyText] = useState('');
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'policy' | 'fee' | null>(null);

  // Fee collection form
  const [sourceUserId, setSourceUserId] = useState('');
  const [treasuryUserId, setTreasuryUserId] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeReasonCode, setFeeReasonCode] = useState('');
  const [originPlugin, setOriginPlugin] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/service-credits/admin/treasury');
      if (!res.ok) {
        throw new Error(`Could not load treasury config (${res.status}).`);
      }
      const data = (await res.json()) as TreasuryConfigResponse;
      setPolicyText(JSON.stringify(data.treasuryConfig ?? {}, null, 2));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load treasury config.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function parsedPolicy(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(policyText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setPolicyError('Policy must be a JSON object.');
        return null;
      }
      setPolicyError(null);
      return parsed as Record<string, unknown>;
    } catch {
      setPolicyError('Policy is not valid JSON.');
      return null;
    }
  }

  async function savePolicy() {
    const policy = parsedPolicy();
    if (!policy) return;
    setBusy('policy');
    setError(null);
    setNotice(null);
    const result = await scAdminMutate('/api/service-credits/admin/treasury', 'PUT', { policy });
    setBusy(null);
    if (!result.ok) {
      setError(result.message ?? 'Could not save the treasury policy.');
      return;
    }
    setNotice('Treasury policy saved.');
    setPolicyText(JSON.stringify(policy, null, 2));
  }

  const fee = Number(feeAmount);
  const feeReady =
    sourceUserId.trim() && treasuryUserId.trim() && Number.isFinite(fee) && fee > 0 && feeReasonCode.trim() && originPlugin.trim();

  async function collectFee() {
    setBusy('fee');
    setError(null);
    setNotice(null);
    const result = await scAdminMutate<TreasuryFeeResponse>('/api/service-credits/admin/treasury/fees/collect', 'POST', {
      sourceUserId: sourceUserId.trim(),
      treasuryUserId: treasuryUserId.trim(),
      amount: fee,
      feeReasonCode: feeReasonCode.trim(),
      originPlugin: originPlugin.trim(),
      idempotencyKey: newIdempotencyKey('fee'),
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.message ?? 'Could not collect the fee.');
      return;
    }
    setNotice(`Fee of ${fee} credits collected. Treasury event ${result.data?.collection?.treasuryEventId ?? 'recorded'}.`);
    setSourceUserId('');
    setTreasuryUserId('');
    setFeeAmount('');
    setFeeReasonCode('');
    setOriginPlugin('');
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Treasury</h2>
        <p className="text-sm text-muted-foreground">
          Review and edit the treasury policy, and move a fee from a member into the treasury wallet.
        </p>
      </header>

      <Feedback error={error} notice={notice} />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Treasury policy</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <textarea
              className="h-48 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
              value={policyText}
              spellCheck={false}
              onChange={(event) => {
                setPolicyText(event.target.value);
                setPolicyError(null);
              }}
            />
            {policyError ? <p className="text-xs text-red-300">{policyError}</p> : null}
            <ConfirmAction
              label="Save policy"
              busy={busy === 'policy'}
              onConfirm={() => void savePolicy()}
              summary="Replace the stored treasury policy with the JSON above. This overwrites the whole policy object."
            />
          </>
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Collect fee</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source member user ID" value={sourceUserId} onChange={setSourceUserId} placeholder="user_…" />
          <Field label="Treasury wallet user ID" value={treasuryUserId} onChange={setTreasuryUserId} placeholder="user_…" />
          <Field label="Amount (credits)" type="number" value={feeAmount} onChange={setFeeAmount} placeholder="0" />
          <Field label="Fee reason code" value={feeReasonCode} onChange={setFeeReasonCode} placeholder="e.g. relay_fee" />
          <Field label="Origin plugin" value={originPlugin} onChange={setOriginPlugin} placeholder="e.g. socketrelay" />
        </div>
        <ConfirmAction
          label="Collect fee"
          busy={busy === 'fee'}
          disabled={!feeReady}
          onConfirm={() => void collectFee()}
          summary={
            <>
              Move <strong>{feeReady ? fee : 0}</strong> credits from member{' '}
              <strong>{sourceUserId.trim() || '—'}</strong> into treasury wallet{' '}
              <strong>{treasuryUserId.trim() || '—'}</strong>. This reduces the member balance.
            </>
          }
        />
      </div>
    </section>
  );
}
