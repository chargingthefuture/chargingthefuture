'use client';

import { useEffect, useState } from 'react';

// The member's own ServiceCredits balance for the Me screen, from the wallet route the
// ServiceCredits page reads.
export type CreditsState = { kind: 'loading' } | { kind: 'ready'; available: number } | { kind: 'error' };

export function useCredits(): CreditsState {
  const [state, setState] = useState<CreditsState>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    fetch('/api/service-credits/wallet', { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { wallet?: { availableBalance?: unknown } } | null;
        const available = body?.wallet?.availableBalance;
        if (!res.ok || typeof available !== 'number') throw new Error(`Wallet read failed (HTTP ${res.status}).`);
        if (active) setState({ kind: 'ready', available });
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
