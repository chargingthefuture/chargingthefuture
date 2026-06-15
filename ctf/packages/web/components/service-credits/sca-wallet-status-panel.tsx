'use client';

// Wallet-status panel: freeze or unfreeze a member's wallet. A frozen wallet cannot spend
// ServiceCredits on either rail — used for a risk-flagged account. State-changing money
// operation, so each action is gated behind an explicit confirm step. Wired to:
//   POST /api/service-credits/admin/wallet-status  <- { targetUserId, frozen, reason? }
import { useState } from 'react';
import { Field, ConfirmAction, Feedback } from './sca-fields';
import { scAdminMutate, type WalletStatusResponse } from './sca-shared';

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
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Wallet freeze</h2>
        <p className="text-sm text-muted-foreground">
          Freezing blocks all spending; use for a risk-flagged account. Unfreeze to restore.
        </p>
      </header>

      <Feedback error={error} notice={notice} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Member user ID" value={targetUserId} onChange={setTargetUserId} placeholder="user_…" />
        <Field label="Reason (optional)" value={reason} onChange={setReason} placeholder="Why this changed" />
      </div>

      <div className="flex flex-wrap gap-3">
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
