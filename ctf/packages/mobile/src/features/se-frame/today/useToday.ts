// The Android copy of the web's use-today.ts: reads /api/today, keeps the last answer on the phone
// so Today draws at once on the next open, and keeps read and hidden marks per member.

import { useCallback, useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import type { SeToday, SeTodayMarks } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';

export type TodayMarks = SeTodayMarks;

function store(name: string): File {
  return new File(Paths.document, name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
}

async function readJson<T>(name: string): Promise<T | null> {
  try {
    const file = store(name);
    if (!file.exists) return null;
    return JSON.parse(await file.text()) as T;
  } catch {
    // no-trace: nothing saved yet, or the saved copy is unreadable; the screen reads fresh.
    return null;
  }
}

function writeJson(name: string, value: unknown) {
  try {
    const file = store(name);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch (error) {
    reportError(error, { area: 'today', op: 'save_copy' });
  }
}

async function readMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown } | null;
    if (body && typeof body.message === 'string' && body.message) return body.message;
  } catch {
    // no-trace: the body is not JSON; the fallback sentence is shown.
  }
  return fallback;
}

export function useToday(accountId: string) {
  const [today, setToday] = useState<SeToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<TodayMarks>({ read: [], hidden: [] });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const fallback = 'Could not load Today.';
    try {
      const res = await authedFetch('/api/today');
      if (!res.ok) {
        setError(await readMessage(res, fallback));
        return;
      }
      const body = (await res.json()) as { today: SeToday };
      setToday(body.today);
      writeJson(`se-today-${accountId}`, body.today);
    } catch (caught) {
      reportError(caught, { area: 'today', op: 'load' });
      setError(fallback);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [cached, savedMarks] = await Promise.all([
        readJson<SeToday>(`se-today-${accountId}`),
        readJson<TodayMarks>(`se-today-marks-${accountId}`),
      ]);
      if (!live) return;
      if (cached) setToday((current) => current ?? cached);
      if (savedMarks) setMarks(savedMarks);
    })();
    void load();
    return () => {
      live = false;
    };
  }, [accountId, load]);

  const mark = useCallback(
    (kind: keyof TodayMarks, cardId: string) => {
      setMarks((current) => {
        if (current[kind].includes(cardId)) return current;
        const next = { ...current, [kind]: [...current[kind], cardId].slice(-300) };
        writeJson(`se-today-marks-${accountId}`, next);
        return next;
      });
    },
    [accountId],
  );

  return { today, loading, error, marks, mark, reload: load };
}
