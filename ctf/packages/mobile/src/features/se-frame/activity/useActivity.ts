// The Android copy of the web's use-activity.ts and use-activity-answer.ts: read the member's
// notifications, mark one read when it is opened or answered, and send an inline answer from Needs
// you.

import { useCallback, useEffect, useState } from 'react';
import type { SeActivityButton, SeActivityItem } from '@ctf/shared';
import { authedFetch, authedFetchJson } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';

export type ActivityState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; items: SeActivityItem[] };
export type AnswerStatus = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

const CSRF = { 'x-ctf-csrf': '1' };

export function useActivity() {
  const [state, setState] = useState<ActivityState>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const body = await authedFetchJson<{ notifications?: SeActivityItem[] }>('/api/notifications');
      setState({ kind: 'ready', items: body.notifications ?? [] });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // `keepShown` marks it read on the server only, so an answered notice stays in place showing what
  // was done until the next visit.
  const markRead = useCallback((id: string, keepShown = false) => {
    void authedFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: CSRF }).catch(() => undefined);
    if (keepShown) return;
    setState((current) =>
      current.kind === 'ready' ? { kind: 'ready', items: current.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)) } : current,
    );
  }, []);
  return { state, reload: load, markRead };
}

async function send(button: SeActivityButton & { path: string }): Promise<string | null> {
  try {
    const res = await authedFetch(button.path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...CSRF },
      body: JSON.stringify(button.body),
    });
    if (res.ok) return null;
    const answer = (await res.json().catch(() => null)) as { message?: unknown } | null;
    return typeof answer?.message === 'string' ? `${button.failed} ${answer.message}` : `${button.failed} (HTTP ${res.status})`;
  } catch (error) {
    reportError(error, { area: 'activity', op: 'answer' });
    return `${button.failed} The request did not reach the server.`;
  }
}

export function useActivityAnswer(onSaved: (_keepShown: boolean) => void) {
  const [status, setStatus] = useState<AnswerStatus>({ kind: 'idle' });
  const answer = async (button: SeActivityButton) => {
    if (!button.path) {
      onSaved(false);
      return;
    }
    setStatus({ kind: 'busy', label: button.label });
    const error = await send({ ...button, path: button.path });
    setStatus(error ? { kind: 'error', text: error } : { kind: 'done', text: button.done });
    if (!error) onSaved(true);
  };
  return { status, answer };
}
