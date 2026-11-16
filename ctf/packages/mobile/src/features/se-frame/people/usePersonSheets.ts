// The reads and the send behind People's two sheets on Android, the copy of the web's
// components/se-frame/people/use-person-sheets.ts: the same Directory and Foundation routes.

import { useEffect, useState } from 'react';
import {
  SE_PERSON_SHEET_WORDS as W,
  seFoundationFailure,
  sePersonProfileFrom,
  seQuoteProviderFrom,
  seQuoteServiceType,
  type SePersonProfile,
  type SeQuoteProvider,
} from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';

export type SheetRead<T> = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'ready'; value: T };

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

function useRead<T>(path: string, attempt: number, parse: (_body: unknown) => T | null, fallback: string): SheetRead<T> {
  const [read, setRead] = useState<SheetRead<T>>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    setRead({ kind: 'loading' });
    authedFetch(path)
      .then(async (res) => {
        const body: unknown = await res.json().catch(() => null);
        const value = res.ok ? parse(body) : null;
        if (!live) return;
        if (value) setRead({ kind: 'ready', value });
        else setRead({ kind: 'failed', message: `${seFoundationFailure(body, fallback)} (HTTP ${res.status})` });
      })
      .catch((error: unknown) => {
        if (live) setRead({ kind: 'failed', message: `${fallback} ${error instanceof Error ? error.message : String(error)}` });
      });
    return () => {
      live = false;
    };
  }, [path, attempt, parse, fallback]);
  return read;
}

export function usePersonProfile(profileId: string, attempt: number): SheetRead<SePersonProfile> {
  return useRead(`/api/directory/profiles/${encodeURIComponent(profileId)}`, attempt, sePersonProfileFrom, W.profileFailed);
}

export function useQuoteProvider(profileId: string, attempt: number) {
  return useRead(`/api/foundation/providers/${encodeURIComponent(profileId)}`, attempt, seQuoteProviderFrom, W.providerFailed);
}

async function failure(res: Response, fallback: string): Promise<Error> {
  return new Error(seFoundationFailure(await res.json().catch(() => null), fallback));
}

// Open a connection with the provider, then request the quote on it. Throws with the text to show.
export async function sendQuoteRequest(provider: SeQuoteProvider): Promise<void> {
  const threadRes = await authedFetch('/api/foundation/connections/threads', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ providerId: provider.profileId }),
  });
  if (!threadRes.ok) throw await failure(threadRes, W.connectFailed);
  const threadData = (await threadRes.json().catch(() => null)) as { thread?: { id?: string } } | null;
  const threadId = threadData?.thread?.id;
  if (!threadId) throw new Error(W.incomplete);
  const quoteRes = await authedFetch('/api/foundation/quotes', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ threadId, serviceType: seQuoteServiceType(provider.headline) }),
  });
  if (!quoteRes.ok) throw await failure(quoteRes, W.quoteFailed);
}
