// One page of People and the number listed, the Android copy of the web (components/se-frame/people/
// use-people.ts). A member not approved yet gets the locked board, not an error.

import { useEffect, useState } from 'react';
import { sePeopleCategory, type SePeopleFilter, type SePeoplePage } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';

export type PeopleState =
  | { kind: 'loading' }
  | { kind: 'locked' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; people: SePeoplePage };

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
  if (body?.reason === 'unlock_required') return { kind: 'locked' };
  if (!res.ok || !body?.people) throw new Error(`${body?.message ?? 'The server returned an error.'} (HTTP ${res.status})`);
  return { kind: 'ready', people: body.people };
}

export function usePeople(page: number, filter: SePeopleFilter, query: string, attempt: number): PeopleState {
  const [state, setState] = useState<PeopleState>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      authedFetch(`/api/people?${peopleParams(page, filter, query)}`)
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
      clearTimeout(timer);
    };
  }, [page, filter, query, attempt]);
  return state;
}

// The number of people listed, or null while it loads or when it could not be read.
export function usePeopleCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    authedFetch('/api/people/count')
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
