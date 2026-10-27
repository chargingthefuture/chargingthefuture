'use client';

import { useEffect, useState } from 'react';
import type { SePeoplePage } from '@ctf/shared';

// One page of People. The page number lives in the address (?tab=people&page=2) so a page can be
// linked and the back button works.

export type PeopleState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; people: SePeoplePage };

export function readPage(): number {
  if (typeof window === 'undefined') return 1;
  const page = Number.parseInt(new URLSearchParams(window.location.search).get('page') ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function writePage(page: number) {
  const params = new URLSearchParams(window.location.search);
  params.set('tab', 'people');
  if (page > 1) params.set('page', String(page));
  else params.delete('page');
  window.history.replaceState(null, '', `/?${params.toString()}`);
}

export function usePeople(page: number, offeringOnly: boolean, query: string, attempt: number): PeopleState {
  const [state, setState] = useState<PeopleState>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page) });
    if (offeringOnly) params.set('offering', '1');
    if (query.trim()) params.set('q', query.trim());
    const timer = window.setTimeout(() => {
      fetch(`/api/people?${params.toString()}`, { cache: 'no-store' })
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as { people?: SePeoplePage; message?: string } | null;
          if (!res.ok || !body?.people) throw new Error(`${body?.message ?? 'The server returned an error.'} (HTTP ${res.status})`);
          if (active) setState({ kind: 'ready', people: body.people });
        })
        .catch((error: unknown) => {
          if (active) setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [page, offeringOnly, query, attempt]);
  return state;
}
