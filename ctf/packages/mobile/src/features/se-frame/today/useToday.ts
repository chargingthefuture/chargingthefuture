// The Android copy of the web's use-today.ts: reads /api/today (or /api/today/public for a visitor
// who is not signed in), keeps the last answer on the phone so Today draws at once on the next open,
// and keeps read and hidden marks per member ('guest' for a visitor).

import { useCallback, useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { seMarksFromSaved, seToggleRead, type SeToday, type SeTodayMarks } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';

export type TodayMarks = SeTodayMarks;
export type MarkKind = 'read' | 'hidden';

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

// `accountId` null: a visitor who is not signed in. Their copy and marks are kept under 'guest'.
export function useToday(accountId: string | null) {
  const owner = accountId ?? 'guest';
  const url = accountId ? '/api/today' : '/api/today/public';
  const [today, setToday] = useState<SeToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<TodayMarks>({ read: [], hidden: [] });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const fallback = 'Could not load Today.';
    try {
      const res = await authedFetch(url);
      if (!res.ok) {
        setError(await readMessage(res, fallback));
        return;
      }
      const body = (await res.json()) as { today: SeToday };
      setToday(body.today);
      writeJson(`se-today-${owner}`, body.today);
    } catch (caught) {
      reportError(caught, { area: 'today', op: 'load' });
      setError(fallback);
    } finally {
      setLoading(false);
    }
  }, [url, owner]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [cached, savedMarks] = await Promise.all([
        readJson<SeToday>(`se-today-${owner}`),
        readJson<unknown>(`se-today-marks-${owner}`),
      ]);
      if (!live) return;
      if (cached) setToday((current) => current ?? cached);
      // Marks saved before the day was kept count as marked today (seMarksFromSaved).
      if (savedMarks) setMarks(seMarksFromSaved(savedMarks));
    })();
    void load();
    return () => {
      live = false;
    };
  }, [owner, load]);

  const mark = useCallback(
    (kind: MarkKind, cardId: string) => {
      setMarks((current) => {
        if (current[kind].includes(cardId)) return current;
        const next = kind === 'read' ? seToggleRead(current, cardId) : { ...current, hidden: [...current.hidden, cardId].slice(-300) };
        writeJson(`se-today-marks-${owner}`, next);
        return next;
      });
    },
    [owner],
  );

  // Done is a toggle on the card's timeline dot, so a card marked by mistake can be unmarked. The day it
  // was marked is kept with it: a done card leaves Today from the member's next day.
  const toggle = useCallback(
    (kind: MarkKind, cardId: string) => {
      setMarks((current) => {
        const has = current[kind].includes(cardId);
        const next =
          kind === 'read'
            ? seToggleRead(current, cardId)
            : { ...current, hidden: has ? current.hidden.filter((id) => id !== cardId) : [...current.hidden, cardId].slice(-300) };
        writeJson(`se-today-marks-${owner}`, next);
        return next;
      });
    },
    [owner],
  );

  return { today, loading, error, marks, mark, toggle, reload: load };
}
