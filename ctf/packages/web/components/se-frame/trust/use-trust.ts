'use client';

import { useEffect, useState } from 'react';
import { SE_TRUST_WORDS as W, seTrustViewFrom, type SeTrustView } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';

// Reads one trust route: the member's own (Me → Trust) or another member's (People's profile).
// `locked` is the Unlock gate answering; it is not a failure.
export type TrustRead = { kind: 'loading' } | { kind: 'ready'; view: SeTrustView } | { kind: 'locked' } | { kind: 'failed'; message: string };

async function readTrust(path: string): Promise<TrustRead> {
  const res = await fetch(path, { cache: 'no-store' });
  if (res.status === 403) return { kind: 'locked' };
  if (!res.ok) return { kind: 'failed', message: await responseFailureText(res, W.failed, 'member') };
  const view = seTrustViewFrom(await res.json().catch(() => null));
  return view ? { kind: 'ready', view } : { kind: 'failed', message: W.failed };
}

export function useTrust(path: string | null, attempt: number): TrustRead {
  const [read, setRead] = useState<TrustRead>({ kind: 'loading' });
  useEffect(() => {
    if (!path) return undefined;
    let active = true;
    setRead({ kind: 'loading' });
    readTrust(path)
      .then((next) => {
        if (active) setRead(next);
      })
      .catch((error: unknown) => {
        const message = failureText(error, { area: 'se-frame', op: 'trust_read', fallback: W.failed, audience: 'member' });
        if (active) setRead({ kind: 'failed', message });
      });
    return () => {
      active = false;
    };
  }, [path, attempt]);
  return read;
}
