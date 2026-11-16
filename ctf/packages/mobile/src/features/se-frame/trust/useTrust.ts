// Reads one trust route on Android, the copy of the web's components/se-frame/trust/use-trust.ts:
// the member's own (Me → Trust) or another member's (People's profile). `locked` is the Unlock gate
// answering; it is not a failure.

import { useEffect, useState } from 'react';
import { SE_TRUST_WORDS as W, seTrustViewFrom, type SeTrustView } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';

export type TrustRead = { kind: 'loading' } | { kind: 'ready'; view: SeTrustView } | { kind: 'locked' } | { kind: 'failed'; message: string };

function said(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const message = (body as Record<string, unknown>).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function readTrust(path: string): Promise<TrustRead> {
  const res = await authedFetch(path);
  if (res.status === 403) return { kind: 'locked' };
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return { kind: 'failed', message: said(body) ?? W.failed };
  const view = seTrustViewFrom(body);
  return view ? { kind: 'ready', view } : { kind: 'failed', message: W.failed };
}

export function useTrust(path: string, attempt: number): TrustRead {
  const [read, setRead] = useState<TrustRead>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    setRead({ kind: 'loading' });
    readTrust(path)
      .then((next) => {
        if (active) setRead(next);
      })
      .catch((error: unknown) => {
        reportError(error, { area: 'se-frame', op: 'trust_read' });
        if (active) setRead({ kind: 'failed', message: W.failed });
      });
    return () => {
      active = false;
    };
  }, [path, attempt]);
  return read;
}
