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
import { getServiceCreditsTokens } from './sc-shared';

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
  const mintReady = mint.targetUserId.trim() && Number.isFinite(mintAmount) && mintAmount > 0 && mint.reason.trim() && mint.ticket.trim();
  const burnReady = burn.targetUserId.trim() && Number.isFinite(burnAmount) && burnAmount > 0 && burn.reason.trim() && burn.ticket.trim();

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, margin: 0 }}>Mint grant</h3>
          <Field label="Member user ID" value={mint.targetUserId} onChange={mint.setTargetUserId} placeholder="user_…" />
          <Field label="Amount (credits)" type="number" value={mint.amount} onChange={mint.setAmount} placeholder="0" />
          <Field label="Governance ticket ID" value={mint.ticket} onChange={mint.setTicket} placeholder="GOV-…" />
          <Field label="Reason" value={mint.reason} onChange={mint.setReason} placeholder="Why this grant is issued" />
          <ConfirmAction
            label="Mint grant"
            busy={busy === 'mint'}
            disabled={!mintReady}
            onConfirm={() => void submitMint()}
            summary={
              <>
                Mint <strong>{mintReady ? mintAmount : 0}</strong> credits to member{' '}
                <strong>{mint.targetUserId.trim() || '—'}</strong> under ticket{' '}
                <strong>{mint.ticket.trim() || '—'}</strong>. This increases their balance and cannot be undone here.
              </>
            }
          />
          {lastAction === 'mint' ? <Feedback error={error} notice={notice} /> : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, margin: 0 }}>Burn</h3>
          <Field label="Member user ID" value={burn.targetUserId} onChange={burn.setTargetUserId} placeholder="user_…" />
          <Field label="Amount (credits)" type="number" value={burn.amount} onChange={burn.setAmount} placeholder="0" />
          <Field label="Governance ticket ID" value={burn.ticket} onChange={burn.setTicket} placeholder="GOV-…" />
          <Field label="Reason" value={burn.reason} onChange={burn.setReason} placeholder="Why these credits are burned" />
          <ConfirmAction
            label="Burn credits"
            tone="danger"
            busy={busy === 'burn'}
            disabled={!burnReady}
            onConfirm={() => void submitBurn()}
            summary={
              <>
                Burn <strong>{burnReady ? burnAmount : 0}</strong> credits from member{' '}
                <strong>{burn.targetUserId.trim() || '—'}</strong> under ticket{' '}
                <strong>{burn.ticket.trim() || '—'}</strong>. This reduces their balance and cannot be undone here.
              </>
            }
          />
          {lastAction === 'burn' ? <Feedback error={error} notice={notice} /> : null}
        </div>
      </div>
    </section>
  );
}
