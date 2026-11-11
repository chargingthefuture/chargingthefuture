// The Android Me screens' reads and writes, the copies of the web's use-me-profile.ts,
// use-credits.ts and use-notify-prefs.ts: the top of Me, the ServiceCredits balance, Read and
// Hidden, and the notification rows with quiet hours. Everything is saved on the account.

import { useCallback, useEffect, useState } from 'react';
import {
  SE_ME_WORDS as W,
  SE_SETTINGS_WORDS as SW,
  type SeMarkedCard,
  type SeMeProfile,
  type SeMePrompts,
  type SeNotifyGroup,
  type SeQuietHours,
} from '@ctf/shared';
import { authedFetch, authedFetchJson } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

function reason(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback} ${error.message}` : fallback;
}

// A read that runs once: loading, its answer, or why it failed.
export type Read<T> = { kind: 'loading' } | { kind: 'ready'; value: T } | { kind: 'error'; message: string };

function useRead<T>(path: string, pick: (_body: Record<string, unknown>) => T, fallback: string, op: string): [Read<T>, (_value: T) => void] {
  const [state, setState] = useState<Read<T>>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    authedFetchJson<Record<string, unknown>>(path)
      .then((body) => active && setState({ kind: 'ready', value: pick(body) }))
      .catch((error: unknown) => {
        reportError(error, { area: 'se-frame', op });
        if (active) setState({ kind: 'error', message: reason(error, fallback) });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per path.
  }, [path]);
  const set = useCallback((value: T) => setState({ kind: 'ready', value }), []);
  return [state, set];
}

export function useMeProfile() {
  const [state, set] = useRead<SeMeProfile>('/api/account/me', (body) => body.profile as SeMeProfile, W.profileFailed, 'me_profile');
  const savePrompts = useCallback(
    async (prompts: SeMePrompts): Promise<string | null> => {
      try {
        const body = await authedFetchJson<{ prompts: SeMePrompts }>('/api/account/me', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(prompts) });
        if (state.kind === 'ready') set({ ...state.value, prompts: body.prompts });
        return null;
      } catch (error) {
        reportError(error, { area: 'se-frame', op: 'me_prompts_save' });
        return reason(error, W.promptsFailed);
      }
    },
    [state, set],
  );
  return { state, savePrompts };
}

export function useCredits(): Read<number> {
  const [state] = useRead<number>(
    '/api/service-credits/wallet',
    (body) => {
      const available = (body.wallet as { availableBalance?: unknown } | undefined)?.availableBalance;
      if (typeof available !== 'number') throw new Error('The wallet answer had no balance.');
      return available;
    },
    W.creditsFailed,
    'me_credits',
  );
  return state;
}

export function useMarked(mark: 'done' | 'not_for_me'): Read<SeMarkedCard[]> {
  const [state] = useRead<SeMarkedCard[]>(`/api/today/marks?mark=${mark}`, (body) => body.cards as SeMarkedCard[], W.listFailed, `me_marked_${mark}`);
  return state;
}

// How many rows a list route answers (blocked people, muted people and words), or null.
export function useCount(path: string, key: string): number | null {
  const [state] = useRead<number | null>(path, (body) => (Array.isArray(body[key]) ? (body[key] as unknown[]).length : null), '', `count_${key}`);
  return state.kind === 'ready' ? state.value : null;
}

export type NotifyState = Record<SeNotifyGroup, boolean> & { quiet: SeQuietHours | null };
type NotifyAnswer = { preferences: { pushReplies: boolean; pushRooms: boolean; pushOther: boolean; quiet: SeQuietHours | null } };
const NOTIFY = '/api/notifications/preferences';
const FIELD: Record<SeNotifyGroup, string> = { replies: 'pushReplies', rooms: 'pushRooms', other: 'pushOther' };

function fromAnswer(body: NotifyAnswer): NotifyState {
  const p = body.preferences;
  return { replies: p.pushReplies, rooms: p.pushRooms, other: p.pushOther, quiet: p.quiet };
}

export function useNotifyPrefs() {
  const [read, set] = useRead<NotifyState>(NOTIFY, (body) => fromAnswer(body as unknown as NotifyAnswer), SW.readFailed, 'notify_prefs');
  const [note, setNote] = useState<string | null>(null);
  const put = useCallback(
    async (body: Record<string, unknown>) => {
      setNote(null);
      try {
        const res = await authedFetch(NOTIFY, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
        const answer = (await res.json().catch(() => null)) as (NotifyAnswer & { message?: string }) | null;
        if (!res.ok || !answer) return setNote(`${SW.saveFailed} ${answer?.message ?? `(HTTP ${res.status})`}`);
        set(fromAnswer(answer));
      } catch (error) {
        reportError(error, { area: 'se-frame', op: 'notify_prefs_save' });
        setNote(SW.saveFailed);
      }
    },
    [set],
  );
  const state = read.kind === 'ready' ? read.value : null;
  const toggle = (group: SeNotifyGroup) => state && void put({ [FIELD[group]]: !state[group] });
  const setQuiet = (quiet: SeQuietHours | null) => void put({ quiet });
  return { state, note: note ?? (read.kind === 'error' ? read.message : null), toggle, setQuiet };
}
