// Problems already on the What Works list that share words with what the member types, the Android
// copy of the web's use-ww-similar.ts: read a moment after they stop typing, so each key press is
// not a request.

import { useEffect, useState } from 'react';
import { authedFetch } from '../../../auth/authedFetch';

export type WwMatch = { id: string; title: string; helpedCount: number };

export type WwMatchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; matches: WwMatch[] } | { kind: 'error'; reason: string };

export const WW_MIN_QUERY = 3;

type Reply = { problems?: WwMatch[]; message?: string };

async function readMatches(q: string): Promise<WwMatch[]> {
  const res = await authedFetch(`/api/what-works/problems/similar?q=${encodeURIComponent(q)}`);
  const body = (await res.json().catch(() => null)) as Reply | null;
  if (!res.ok) throw new Error(body?.message ?? `the list did not answer (HTTP ${res.status})`);
  return body?.problems ?? [];
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : 'the connection failed';
}

export function useWwSimilar(text: string): WwMatchState {
  const [state, setState] = useState<WwMatchState>({ kind: 'idle' });
  const q = text.trim();
  useEffect(() => {
    if (q.length < WW_MIN_QUERY) {
      setState({ kind: 'idle' });
      return;
    }
    let active = true;
    setState({ kind: 'loading' });
    const timer = setTimeout(() => {
      readMatches(q).then(
        (matches) => active && setState({ kind: 'ready', matches }),
        (error: unknown) => active && setState({ kind: 'error', reason: reasonOf(error) }),
      );
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);
  return state;
}
