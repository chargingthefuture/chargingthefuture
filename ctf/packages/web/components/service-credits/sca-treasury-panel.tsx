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
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens, type ServiceCreditsTokens } from './sc-shared';

// Fee collection is ready once both members, a finite positive amount, a reason code, and an
// origin plugin are supplied.
function isFeeReady(
  sourceUserId: string,
  treasuryUserId: string,
  fee: number,
  feeReasonCode: string,
  originPlugin: string,
): boolean {
  return (
    Boolean(sourceUserId.trim()) &&
    Boolean(treasuryUserId.trim()) &&
    Number.isFinite(fee) &&
    fee > 0 &&
    Boolean(feeReasonCode.trim()) &&
    Boolean(originPlugin.trim())
  );
}

// The treasury-policy editor: a loading note, else the JSON textarea plus its parse error and save.
function TreasuryPolicyEditor({
  loading,
  policyText,
  policyError,
  busy,
  onPolicyTextChange,
  onSave,
  t,
}: {
  loading: boolean;
  policyText: string;
  policyError: string | null;
  busy: boolean;
  onPolicyTextChange: (value: string) => void;
  onSave: () => void;
  t: ServiceCreditsTokens;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, margin: 0 }}>Treasury policy</h3>
      {loading ? (
        <p style={{ fontSize: 13, color: t.MUTED, margin: 0 }}>Loading…</p>
      ) : (
        <>
          <textarea
            style={{
              height: 192,
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `1px solid ${t.BORDER_SOLID}`,
              background: t.BG,
              color: t.TITLE,
              padding: '9px 12px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              outline: 'none',
              resize: 'vertical',
            }}
            value={policyText}
            spellCheck={false}
            onChange={(event) => onPolicyTextChange(event.target.value)}
          />
          {policyError ? <p style={{ fontSize: 11, color: '#FCA5A5', margin: 0 }}>{policyError}</p> : null}
          <ConfirmAction
            label="Save policy"
            busy={busy}
            onConfirm={onSave}
            summary="Replace the stored treasury policy with the JSON above. This overwrites the whole policy object."
          />
        </>
      )}
    </div>
  );
}

export function ServiceCreditsTreasuryPanel() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
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
  const feeReady = isFeeReady(sourceUserId, treasuryUserId, fee, feeReasonCode, originPlugin);

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
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, margin: '0 0 4px' }}>Treasury</h2>
        <p style={{ fontSize: 13, color: t.MUTED, margin: 0, lineHeight: 1.5 }}>
          Review and edit the treasury policy, and move a fee from a member into the treasury wallet.
        </p>
      </header>

      <Feedback error={error} notice={notice} />

      <TreasuryPolicyEditor
        loading={loading}
        policyText={policyText}
        policyError={policyError}
        busy={busy === 'policy'}
        onPolicyTextChange={(value) => {
          setPolicyText(value);
          setPolicyError(null);
        }}
        onSave={() => void savePolicy()}
        t={t}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${t.BORDER_SOLID}`, paddingTop: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, margin: 0 }}>Collect fee</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Field label="Source member user ID" value={sourceUserId} onChange={setSourceUserId} placeholder="user_…" />
          <Field label="Treasury wallet user ID" value={treasuryUserId} onChange={setTreasuryUserId} placeholder="user_…" />
          <Field label="Amount (credits)" type="number" value={feeAmount} onChange={setFeeAmount} placeholder="0" />
          <Field label="Fee reason code" value={feeReasonCode} onChange={setFeeReasonCode} placeholder="e.g. relay_fee" />
          <Field label="Origin plugin" value={originPlugin} onChange={setOriginPlugin} placeholder="e.g. socket-relay" />
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
