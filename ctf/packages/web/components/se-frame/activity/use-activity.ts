'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SeActivityItem } from '@ctf/shared';

// Activity reads the app's notifications and marks one read when it is opened.

export type ActivityState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; items: SeActivityItem[] };

const CSRF = { 'x-ctf-csrf': '1' };

export function useActivity() {
  const [state, setState] = useState<ActivityState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as { notifications?: SeActivityItem[]; message?: string } | null;
      if (!res.ok || !body?.notifications) throw new Error(`${body?.message ?? 'The server returned an error.'} (HTTP ${res.status})`);
      setState({ kind: 'ready', items: body.notifications });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback((id: string) => {
    setState((current) =>
      current.kind === 'ready' ? { kind: 'ready', items: current.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)) } : current,
    );
    void fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: CSRF }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(() => {
    setState((current) => (current.kind === 'ready' ? { kind: 'ready', items: current.items.map((item) => ({ ...item, isRead: true })) } : current));
    void fetch('/api/notifications/read-all', { method: 'POST', headers: CSRF }).catch(() => undefined);
  }, []);

  return { state, reload: load, markRead, markAllRead };
}
