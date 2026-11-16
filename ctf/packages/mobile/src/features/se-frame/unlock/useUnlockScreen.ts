// Where the member stands on Android, the copy of the web's use-unlock-screen.ts: the same routes the
// 3.0 Unlock screen and the banner read, GET /api/unlock/status and GET /api/unlock/standing.

import { useCallback, useEffect, useState } from 'react';
import { SE_UNLOCK_SCREEN_WORDS as W, seUnlockStage, type SeUnlockStage, type SeUnlockStanding } from '@ctf/shared';
import { authedFetch, authedFetchJson } from '../../../auth/authedFetch';
import { fetchUnlockStatus } from '../../unlock/api';

export type SeUnlockScreenData =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; stage: SeUnlockStage; standing: SeUnlockStanding | null; helpAsked: boolean };

async function readStanding(): Promise<SeUnlockStanding | null> {
  const body = await authedFetchJson<{ standing?: SeUnlockStanding }>('/api/unlock/standing').catch(() => null);
  return body?.standing ?? null;
}

async function readScreen(): Promise<SeUnlockScreenData> {
  try {
    const [status, standing] = await Promise.all([fetchUnlockStatus(), readStanding()]);
    const stage = seUnlockStage(status);
    const helpAsked = stage === 'send' && standing !== null && !standing.approved && !standing.form;
    return { kind: 'ready', stage, standing, helpAsked };
  } catch (caught) {
    return { kind: 'error', message: `${W.loadFailed} ${caught instanceof Error ? caught.message : 'The server did not answer.'}` };
  }
}

export function useUnlockScreen(): { data: SeUnlockScreenData; reload: () => void } {
  const [data, setData] = useState<SeUnlockScreenData>({ kind: 'loading' });
  const reload = useCallback(() => {
    void readScreen().then(setData);
  }, []);
  useEffect(reload, [reload]);
  return { data, reload };
}

// POST to the route the 3.0 screen and the banner use. Resolves to the message to show, or null.
export async function seUnlockPost(path: string, body: Record<string, string>, failed: string): Promise<string | null> {
  try {
    const res = await authedFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    return payload?.message ?? failed;
  } catch {
    return failed;
  }
}
