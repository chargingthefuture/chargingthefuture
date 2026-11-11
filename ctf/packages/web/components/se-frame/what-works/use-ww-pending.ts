'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_WW_ADMIN_WORDS as W } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';

export type WwSuggestion = { id: string; title: string; helpedCount: number };
export type WwPending = { id: string; title: string; createdAt: string; attachedCount: number; suggestion: WwSuggestion | null };

export type WwPendingState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; items: WwPending[] };

const FALLBACK = 'Could not load new problems.';

// Problems members added, oldest first, each with the listed problem it looks most like.
export function useWwPending(): { state: WwPendingState; reload: () => Promise<void> } {
  const [state, setState] = useState<WwPendingState>({ kind: 'loading' });
  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/what-works/admin/problems/pending', { cache: 'no-store' });
      if (!res.ok) return setState({ kind: 'error', message: await responseFailureText(res, FALLBACK) });
      setState({ kind: 'ready', items: ((await res.json()) as { problems?: WwPending[] }).problems ?? [] });
    } catch (error) {
      setState({ kind: 'error', message: failureText(error, { area: 'what-works', op: 'admin_pending', fallback: FALLBACK, audience: 'operator' }) });
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { state, reload };
}

// POST with the confirmation header every admin change carries. Resolves to the body, or throws
// with what the route said.
export async function wwAdminPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await responseFailureText(res, `${W.failed} (HTTP ${res.status})`));
  return (await res.json()) as T;
}
