'use client';

// Credit-limits panel: set a member's mutual-credit limit. The line is flat and equal by default
// (the policy default applies to everyone); a per-account override is used only when needed — set to
// 0 to revoke. No behavioral score. State-changing money operation, so the commit is gated behind an
// explicit confirm step. Also offers a read-only look-up. Wired to:
//   GET  /api/service-credits/admin/credit-limits?targetUserId=<id>
//   POST /api/service-credits/admin/credit-limits  <- { targetUserId, creditLimit }
import { useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import { scAdminMutate, type CreditLimitResponse, type CreditLimitLookup, type CreditLimitLookupResponse } from './sca-shared';
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens, type ServiceCreditsTokens } from './sc-shared';

// The set-limit action is ready once a member ID and a finite, non-negative limit are supplied.
function isCreditLimitReady(targetUserId: string, creditLimit: string, limit: number): boolean {
  return Boolean(targetUserId.trim()) && creditLimit.length > 0 && Number.isFinite(limit) && limit >= 0;
}

// Read-only look-up trigger. Disabled while a member ID is missing or a look-up is in flight.
function LookUpButton({
  disabled,
  lookingUp,
  onLookUp,
  t,
}: {
  disabled: boolean;
  lookingUp: boolean;
  onLookUp: () => void;
  t: ServiceCreditsTokens;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onLookUp}
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: `1px solid ${t.BORDER_SOLID}`,
        background: t.BG,
        color: t.TITLE,
        padding: '9px 16px',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {lookingUp ? 'Looking up…' : 'Look up'}
    </button>
  );
}

// Read-only card showing a member's current mutual-credit limit, its source, and freeze state.
function CreditLimitLookupCard({ lookup, t }: { lookup: CreditLimitLookup; t: ServiceCreditsTokens }) {
  return (
    <dl
      style={{
        display: 'grid',
        gap: '4px 24px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        borderRadius: 10,
        border: `1px solid ${t.BORDER_SOLID}`,
        background: t.BG,
        padding: 12,
        fontSize: 13,
        margin: 0,
      }}
    >
      <div>
        <dt style={{ color: t.MUTED }}>Mutual-credit limit</dt>
        <dd style={{ fontWeight: 700, color: t.TITLE, margin: 0 }}>{lookup.creditLimit}</dd>
      </div>
      <div>
        <dt style={{ color: t.MUTED }}>Source</dt>
        <dd style={{ fontWeight: 700, color: t.TITLE, margin: 0 }}>{lookup.isDefault ? 'Policy default' : 'Per-account'}</dd>
      </div>
      <div>
        <dt style={{ color: t.MUTED }}>Frozen</dt>
        <dd style={{ fontWeight: 700, color: t.TITLE, margin: 0 }}>{lookup.frozen ? 'Yes' : 'No'}</dd>
      </div>
    </dl>
  );
}

export function ServiceCreditsCreditLimitsPanel() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const [targetUserId, setTargetUserId] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookup, setLookup] = useState<CreditLimitLookup | null>(null);

  const limit = Number(creditLimit);
  const ready = isCreditLimitReady(targetUserId, creditLimit, limit);
  const lookupDisabled = !targetUserId.trim() || lookingUp;

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
      const data = (await res.json().catch(() => null)) as (CreditLimitLookupResponse & { message?: string }) | null;
      if (!res.ok || !data?.ok || !data.creditLimit) {
        setError(data?.message ?? 'Could not look up this member.');
        return;
      }
      setLookup(data.creditLimit);
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
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, margin: '0 0 4px' }}>Mutual-credit limits</h2>
        <p style={{ fontSize: 13, color: t.MUTED, margin: 0, lineHeight: 1.5 }}>
          New accounts start at 0. Raise a limit only for trusted members; set to 0 to revoke.
        </p>
      </header>

      <Feedback error={error} notice={notice} />

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Field label="Member user ID" value={targetUserId} onChange={setTargetUserId} placeholder="user_…" />
        <Field label="Credit limit (ServiceCredits)" type="number" value={creditLimit} onChange={setCreditLimit} placeholder="0" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <LookUpButton disabled={lookupDisabled} lookingUp={lookingUp} onLookUp={() => void lookUp()} t={t} />
        {lookup ? <CreditLimitLookupCard lookup={lookup} t={t} /> : null}
        <p style={{ fontSize: 11, color: t.MUTED, margin: 0, lineHeight: 1.5 }}>
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
