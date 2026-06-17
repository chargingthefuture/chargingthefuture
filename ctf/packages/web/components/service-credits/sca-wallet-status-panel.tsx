'use client';

// Wallet-status panel: freeze or unfreeze a member's wallet. A frozen wallet cannot spend
// ServiceCredits on either rail — used for a risk-flagged account. State-changing money
// operation, so each action is gated behind an explicit confirm step. Wired to:
//   POST /api/service-credits/admin/wallet-status  <- { targetUserId, frozen, reason? }
import { useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import { scAdminMutate, type WalletStatusResponse } from './sca-shared';

// Admin design tokens (shared dark admin look). ServiceCredits accent is purple #A855F7.
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

export function ServiceCreditsWalletStatusPanel() {
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const id = targetUserId.trim();
  const ready = id.length > 0;

  async function submit(frozen: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await scAdminMutate<WalletStatusResponse>('/api/service-credits/admin/wallet-status', 'POST', {
      targetUserId: id,
      frozen,
      reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? `Could not ${frozen ? 'freeze' : 'unfreeze'} this wallet.`);
      return;
    }
    const state = result.data?.walletStatus?.frozen ?? frozen;
    setNotice(
      result.message ?? `${id}'s wallet is now ${state ? 'frozen — they cannot spend ServiceCredits' : 'unfrozen — spending restored'}.`,
    );
    setReason('');
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <header>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: '0 0 4px' }}>Wallet freeze</h2>
        <p style={{ fontSize: 13, color: SUBTLE, margin: 0, lineHeight: 1.5 }}>
          Freezing blocks all spending; use for a risk-flagged account. Unfreeze to restore.
        </p>
      </header>

      <Feedback error={error} notice={notice} />

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Field label="Member user ID" value={targetUserId} onChange={setTargetUserId} placeholder="user_…" />
        <Field label="Reason (optional)" value={reason} onChange={setReason} placeholder="Why this changed" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <ConfirmAction
          label="Freeze wallet"
          tone="danger"
          busy={busy}
          disabled={!ready}
          onConfirm={() => void submit(true)}
          summary={
            <>
              Freeze <strong>{id || '—'}</strong>&apos;s wallet — they will not be able to spend ServiceCredits.
            </>
          }
        />
        <ConfirmAction
          label="Unfreeze wallet"
          busy={busy}
          disabled={!ready}
          onConfirm={() => void submit(false)}
          summary={
            <>
              Unfreeze <strong>{id || '—'}</strong>&apos;s wallet — they will be able to spend ServiceCredits again.
            </>
          }
        />
      </div>
    </section>
  );
}
