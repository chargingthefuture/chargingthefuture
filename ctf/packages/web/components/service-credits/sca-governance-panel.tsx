'use client';

// Governance panel: mint a grant of credits to a member, or burn credits from a member.
// Both require a governance ticket reference and a reason; both are state-changing money
// operations, so each is committed only behind an explicit confirm step that restates
// exactly what will happen. Wired to:
//   POST /api/service-credits/admin/governance/mint-grants
//   POST /api/service-credits/admin/governance/burns
import { useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import { scAdminMutate, newIdempotencyKey, type BurnResponse, type MintGrantResponse } from './sca-shared';
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens, type ServiceCreditsTokens } from './sc-shared';

function useGovernanceForm() {
  const [targetUserId, setTargetUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [ticket, setTicket] = useState('');
  const reset = () => {
    setTargetUserId('');
    setAmount('');
    setReason('');
    setTicket('');
  };
  return { targetUserId, setTargetUserId, amount, setAmount, reason, setReason, ticket, setTicket, reset };
}

type GovernanceForm = ReturnType<typeof useGovernanceForm>;

// A mint or a burn is ready once a member, a finite positive amount, a reason, and a ticket exist.
function isGovernanceReady(targetUserId: string, amount: number, reason: string, ticket: string): boolean {
  return Boolean(targetUserId.trim()) && Number.isFinite(amount) && amount > 0 && Boolean(reason.trim()) && Boolean(ticket.trim());
}

// One side of the governance panel (mint or burn). The verb/preposition/balance-effect props keep
// each side's confirm summary and copy exactly as shipped while sharing a single field layout.
function GovernanceSubForm({
  title,
  form,
  amount,
  ready,
  busy,
  tone,
  confirmLabel,
  reasonPlaceholder,
  verb,
  preposition,
  balanceEffect,
  showFeedback,
  error,
  notice,
  onConfirm,
  t,
}: {
  title: string;
  form: GovernanceForm;
  amount: number;
  ready: boolean;
  busy: boolean;
  tone: 'default' | 'danger';
  confirmLabel: string;
  reasonPlaceholder: string;
  verb: string;
  preposition: string;
  balanceEffect: string;
  showFeedback: boolean;
  error: string | null;
  notice: string | null;
  onConfirm: () => void;
  t: ServiceCreditsTokens;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, margin: 0 }}>{title}</h3>
      <Field label="Member user ID" value={form.targetUserId} onChange={form.setTargetUserId} placeholder="user_…" />
      <Field label="Amount (credits)" type="number" value={form.amount} onChange={form.setAmount} placeholder="0" />
      <Field label="Governance ticket ID" value={form.ticket} onChange={form.setTicket} placeholder="GOV-…" />
      <Field label="Reason" value={form.reason} onChange={form.setReason} placeholder={reasonPlaceholder} />
      <ConfirmAction
        label={confirmLabel}
        tone={tone}
        busy={busy}
        disabled={!ready}
        onConfirm={onConfirm}
        summary={
          <>
            {verb} <strong>{ready ? amount : 0}</strong> credits {preposition} member{' '}
            <strong>{form.targetUserId.trim() || '—'}</strong> under ticket{' '}
            <strong>{form.ticket.trim() || '—'}</strong>. This {balanceEffect} their balance and cannot be undone here.
          </>
        }
      />
      {showFeedback ? <Feedback error={error} notice={notice} /> : null}
    </div>
  );
}

export function ServiceCreditsGovernancePanel() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const mint = useGovernanceForm();
  const burn = useGovernanceForm();
  const [busy, setBusy] = useState<'mint' | 'burn' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Which action produced the current error/notice, so the result renders next to THAT button.
  // The single top-of-panel banner was off-screen on mobile (the burn form sits far below it), so a
  // failed burn — e.g. "Insufficient balance." when the action hit the demo schema — read as "nothing
  // happened." Showing it inline under the action makes the outcome impossible to miss.
  const [lastAction, setLastAction] = useState<'mint' | 'burn' | null>(null);

  const mintAmount = Number(mint.amount);
  const burnAmount = Number(burn.amount);
  const mintReady = isGovernanceReady(mint.targetUserId, mintAmount, mint.reason, mint.ticket);
  const burnReady = isGovernanceReady(burn.targetUserId, burnAmount, burn.reason, burn.ticket);

  async function submitMint() {
    setBusy('mint');
    setLastAction('mint');
    setError(null);
    setNotice(null);
    const result = await scAdminMutate<MintGrantResponse>('/api/service-credits/admin/governance/mint-grants', 'POST', {
      targetUserId: mint.targetUserId.trim(),
      amount: mintAmount,
      grantReason: mint.reason.trim(),
      governanceTicketId: mint.ticket.trim(),
      idempotencyKey: newIdempotencyKey('mint'),
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.message ?? 'Could not mint the grant.');
      return;
    }
    setNotice(`Minted ${mintAmount} credits. Governance event ${result.data?.grant?.governanceEventId ?? 'recorded'}.`);
    mint.reset();
  }

  async function submitBurn() {
    setBusy('burn');
    setLastAction('burn');
    setError(null);
    setNotice(null);
    const result = await scAdminMutate<BurnResponse>('/api/service-credits/admin/governance/burns', 'POST', {
      targetUserId: burn.targetUserId.trim(),
      amount: burnAmount,
      burnReason: burn.reason.trim(),
      governanceTicketId: burn.ticket.trim(),
      idempotencyKey: newIdempotencyKey('burn'),
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.message ?? 'Could not burn the credits.');
      return;
    }
    setNotice(`Burned ${burnAmount} credits. Governance event ${result.data?.burn?.governanceEventId ?? 'recorded'}.`);
    burn.reset();
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
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, margin: '0 0 4px' }}>Governance</h2>
        <p style={{ fontSize: 13, color: t.MUTED, margin: 0, lineHeight: 1.5 }}>
          Mint new credits to a member or burn credits from a member. Both require a governance ticket
          reference and are written to the audit trail.
        </p>
      </header>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <GovernanceSubForm
          title="Mint grant"
          form={mint}
          amount={mintAmount}
          ready={mintReady}
          busy={busy === 'mint'}
          tone="default"
          confirmLabel="Mint grant"
          reasonPlaceholder="Why this grant is issued"
          verb="Mint"
          preposition="to"
          balanceEffect="increases"
          showFeedback={lastAction === 'mint'}
          error={error}
          notice={notice}
          onConfirm={() => void submitMint()}
          t={t}
        />

        <GovernanceSubForm
          title="Burn"
          form={burn}
          amount={burnAmount}
          ready={burnReady}
          busy={busy === 'burn'}
          tone="danger"
          confirmLabel="Burn credits"
          reasonPlaceholder="Why these credits are burned"
          verb="Burn"
          preposition="from"
          balanceEffect="reduces"
          showFeedback={lastAction === 'burn'}
          error={error}
          notice={notice}
          onConfirm={() => void submitBurn()}
          t={t}
        />
      </div>
    </section>
  );
}
