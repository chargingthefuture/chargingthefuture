'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_UNLOCK_SCREEN_WORDS as W, seUnlockStage, type SeUnlockStage, type SeUnlockStanding } from '@ctf/shared';

// Where the member stands, read from the same routes the 3.0 Unlock page and the banner read:
// GET /api/unlock/status (the address on file and its review) and GET /api/unlock/standing (the day
// count, and whether posting is paused).

export type SeUnlockScreenData =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; stage: SeUnlockStage; standing: SeUnlockStanding | null; helpAsked: boolean };

type StatusBody = { status?: { hasSubmission: boolean; reviewStatus: string | null }; message?: string };

async function readJson<T>(path: string): Promise<{ ok: boolean; status: number; body: T | null }> {
  const res = await fetch(path, { cache: 'no-store' });
  return { ok: res.ok, status: res.status, body: (await res.json().catch(() => null)) as T | null };
}

async function readScreen(): Promise<SeUnlockScreenData> {
  try {
    const [status, standing] = await Promise.all([
      readJson<StatusBody>('/api/unlock/status'),
      readJson<{ standing?: SeUnlockStanding }>('/api/unlock/standing'),
    ]);
    if (!status.ok || !status.body?.status) {
      return { kind: 'error', message: `${W.loadFailed} ${status.body?.message ?? `The server answered ${status.status}.`}` };
    }
    const now = standing.ok ? (standing.body?.standing ?? null) : null;
    const stage = seUnlockStage(status.body.status);
    const helpAsked = stage === 'send' && now !== null && !now.approved && !now.form;
    return { kind: 'ready', stage, standing: now, helpAsked };
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

// POST to the route the 3.0 page and the banner use. Resolves to the message to show, or null.
export async function seUnlockPost(path: string, body: Record<string, string>, failed: string): Promise<string | null> {
  try {
    const res = await fetch(path, {
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
