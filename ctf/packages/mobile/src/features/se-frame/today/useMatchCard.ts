// The Match card's read and save on Android, the copy of the web (components/se-frame/today/
// use-match-card.ts). A member not approved in Unlock gets 401 or 403 and the card is not drawn.

import { useCallback, useEffect, useState } from 'react';
import { SE_MATCH_WORDS as W, type SeMatchChange, type SeMatchState } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';

const URL = '/api/today/match';

export type MatchCardState =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; match: SeMatchState };

type Body = SeMatchState & { message?: string };

async function call(init?: RequestInit): Promise<{ res: Response | null; body: Body | null }> {
  const res = await authedFetch(URL, init).catch(() => null);
  const body = (await res?.json().catch(() => null)) as Body | null;
  return { res, body };
}

function readState(res: Response | null, body: Body | null): MatchCardState {
  if (res && (res.status === 401 || res.status === 403)) return { kind: 'hidden' };
  // The server's message already says what could not be read and why.
  if (!res?.ok || !body) return { kind: 'error', message: body?.message ?? `${W.failed} ${res ? `HTTP ${res.status}.` : 'The app could not be reached.'}` };
  return { kind: 'ready', match: { needs: body.needs, count: body.count } };
}

export function useMatchCard(refreshKey: string | undefined) {
  const [state, setState] = useState<MatchCardState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void call().then(({ res, body }) => {
      if (active) setState(readState(res, body));
    });
    return () => {
      active = false;
    };
  }, [refreshKey, attempt]);
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  // Saves the change; answers null when saved, or the line to show when it was not.
  const save = useCallback(async (change: SeMatchChange): Promise<string | null> => {
    const { res, body } = await call({
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(change.kind === 'code' ? { code: change.code } : { needs: change.needKeys }),
    });
    if (!res?.ok || !body) return `${W.notSaved} ${body?.message ?? (res ? `HTTP ${res.status}` : 'The app could not be reached.')}`;
    setState({ kind: 'ready', match: { needs: body.needs, count: body.count } });
    return null;
  }, []);
  return { state, retry, save };
}
