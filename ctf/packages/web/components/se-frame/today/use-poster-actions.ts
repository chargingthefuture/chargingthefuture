'use client';

import { useState } from 'react';
import { SE_CARD_LIFETIME_WORDS as W } from '@ctf/shared';

// The poster's own controls on an ask or offer: close it (Done, or Closed, not done) and keep it up
// for 14 more days. Both answer with a line to show and tell Today to read again.

export type PosterStatus = { kind: 'idle' } | { kind: 'busy'; what: 'close' | 'renew' } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

async function post(cardId: string, path: 'close' | 'renew', body: unknown, fallback: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/today/cards/${encodeURIComponent(cardId)}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(body ?? {}),
    });
    if (res.ok) return null;
    const answer = (await res.json().catch(() => null)) as { message?: unknown } | null;
    return typeof answer?.message === 'string' ? `${fallback} ${answer.message}` : `${fallback} (HTTP ${res.status})`;
  } catch {
    // no-trace: the request did not reach the server; the member is told and can try again.
    return `${fallback} The request did not reach the server.`;
  }
}

export function usePosterActions(cardId: string, onChanged?: () => void) {
  const [status, setStatus] = useState<PosterStatus>({ kind: 'idle' });
  const run = async (what: 'close' | 'renew', body: unknown, failed: string, doneText: string) => {
    setStatus({ kind: 'busy', what });
    const error = await post(cardId, what, body, failed);
    setStatus(error ? { kind: 'error', text: error } : { kind: 'done', text: doneText });
    if (!error) onChanged?.();
  };
  return {
    status,
    // With Done, the member the poster picked from those who offered help, if any.
    close: (outcome: 'done' | 'not_done', helperId?: string) => run('close', helperId ? { outcome, helperId } : { outcome }, W.closeFailed, W.closed),
    renew: () => run('renew', {}, W.renewFailed, W.renewed),
  };
}
