"use client";

import { useEffect, useState } from "react";

export function ServiceCreditsShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Helper to refresh wallet and set state
  async function refreshWallet() {
    try {
      const res = await fetch('/api/service-credits/wallet');
      if (res.ok) {
        setWallet(await res.json());
      }
    } catch {
      // Ignore errors here; handled in main fetches
    }
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    refreshWallet()
      .catch((e) => setError(e.message || 'Failed to load wallet.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleTransfer(transfer: any) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/service-credits/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfer),
      });
      if (!res.ok) throw new Error('Failed to create transfer');
      // Refetch wallet to update balance and ledger
      await refreshWallet();
    } catch (e: any) {
      setError(e.message || 'Failed to create transfer.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEscrow(escrow: any) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/service-credits/escrows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(escrow),
      });
      if (!res.ok) throw new Error('Failed to create escrow');
      // Refetch wallet to update balance and ledger
      await refreshWallet();
    } catch (e: any) {
      setError(e.message || 'Failed to create escrow.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading wallet…</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!wallet) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Service Credits</h2>
        <p className="mb-4">Your wallet is empty. Earn credits by contributing to the community.</p>
      </div>
    );
  }
  if (!wallet.ledger || !wallet.ledger.length) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Transactions</h2>
        <p className="mb-4">No transactions yet.</p>
      </div>
    );
  }

  // ...existing UI code, now using wallet, handleTransfer, handleEscrow...
  return (
    <div>
      {/* Service Credits UI goes here, using fetched data and handlers */}
    </div>
  );
}
