'use client';

import { useEffect, useState } from 'react';
import { responseFailureText, reasonText } from 'lib/errors/client-failure';

export type WwMatch = { id: string; title: string; helpedCount: number };

export type WwMatchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; matches: WwMatch[] }
  | { kind: 'error'; reason: string };

export const WW_MIN_QUERY = 3;

async function readMatches(q: string): Promise<WwMatch[]> {
  const res = await fetch(`/api/what-works/problems/similar?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await responseFailureText(res, `the list did not answer (HTTP ${res.status})`, 'member'));
  const body = (await res.json()) as { problems?: WwMatch[] };
  return body.problems ?? [];
}

// Problems already on the list that share words with what the member types, read a moment after
// they stop typing so each key press is not a request.
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
    const timer = window.setTimeout(() => {
      readMatches(q).then(
        (matches) => active && setState({ kind: 'ready', matches }),
        (error: unknown) => active && setState({ kind: 'error', reason: reasonText(error) }),
      );
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q]);
  return state;
}
