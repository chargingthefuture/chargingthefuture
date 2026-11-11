'use client';

import { useEffect, useState } from 'react';
import { sePeopleCategory, type SePeopleFilter, type SePeoplePage } from '@ctf/shared';

// One page of People, and the number of people listed. The page number lives in the address
// (?tab=people&page=2) so a page can be linked and the back button works.

export type PeopleState =
  | { kind: 'loading' }
  | { kind: 'locked' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; people: SePeoplePage };

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

function peopleParams(page: number, filter: SePeopleFilter, query: string): string {
  const params = new URLSearchParams({ page: String(page) });
  if (filter === 'offering') params.set('offering', '1');
  const category = sePeopleCategory(filter);
  if (category) params.set('category', category);
  if (query.trim()) params.set('q', query.trim());
  return params.toString();
}

async function readPeople(res: Response): Promise<PeopleState> {
  const body = (await res.json().catch(() => null)) as { people?: SePeoplePage; message?: string; reason?: string } | null;
  // A member not approved yet sees the locked board, not an error.
  if (body?.reason === 'unlock_required') return { kind: 'locked' };
  if (!res.ok || !body?.people) throw new Error(`${body?.message ?? 'The server returned an error.'} (HTTP ${res.status})`);
  return { kind: 'ready', people: body.people };
}

export function usePeople(page: number, filter: SePeopleFilter, query: string, attempt: number): PeopleState {
  const [state, setState] = useState<PeopleState>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      fetch(`/api/people?${peopleParams(page, filter, query)}`, { cache: 'no-store' })
        .then(readPeople)
        .then((next) => {
          if (active) setState(next);
        })
        .catch((error: unknown) => {
          if (active) setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [page, filter, query, attempt]);
  return state;
}

// The number of people listed, or null while it loads or when it could not be read (the screen then
// leaves the number out rather than showing a wrong one).
export function usePeopleCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/people/count', { cache: 'no-store' })
      .then(async (res) => ((await res.json().catch(() => null)) as { listed?: number } | null)?.listed)
      .then((listed) => {
        if (active && typeof listed === 'number') setCount(listed);
      })
      .catch(() => {
        // no-trace: the count is left out; the list below says what failed if it fails too.
      });
    return () => {
      active = false;
    };
  }, []);
  return count;
}
