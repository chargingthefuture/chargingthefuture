'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SeToday, SeTodayMarks } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';

// Reads /api/today (or, for a visitor who is not signed in, /api/today/public), and keeps the last answer in this browser so the screen draws at once on the
// next open and is replaced when the fresh answer arrives. Read and hidden marks are kept here too,
// per member, until they have a home on the server.

const CACHE_PREFIX = 'se-today-v1:';
const MARKS_PREFIX = 'se-today-marks-v1:';

export type TodayMarks = SeTodayMarks;

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // no-trace: storage refused or holds something unreadable; the screen reads fresh.
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-trace: storage refused; the screen still works for this visit.
  }
}

// `accountId` null: a visitor who is not signed in. Their cache and marks are kept under 'guest'.
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
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        setError(await responseFailureText(res, fallback, 'member'));
        return;
      }
      const body = (await res.json()) as { today: SeToday };
      setToday(body.today);
      writeJson(CACHE_PREFIX + owner, body.today);
    } catch (caught) {
      setError(failureText(caught, { area: 'today', op: 'load', fallback, audience: 'member' }));
    } finally {
      setLoading(false);
    }
  }, [owner, url]);

  useEffect(() => {
    const cached = readJson<SeToday>(CACHE_PREFIX + owner);
    if (cached) setToday(cached);
    setMarks(readJson<TodayMarks>(MARKS_PREFIX + owner) ?? { read: [], hidden: [] });
    void load();
  }, [owner, load]);

  const mark = useCallback(
    (kind: keyof TodayMarks, cardId: string) => {
      setMarks((current) => {
        if (current[kind].includes(cardId)) return current;
        const next = { ...current, [kind]: [...current[kind], cardId].slice(-300) };
        writeJson(MARKS_PREFIX + owner, next);
        return next;
      });
    },
    [owner],
  );

  return { today, loading, error, marks, mark, reload: load };
}
