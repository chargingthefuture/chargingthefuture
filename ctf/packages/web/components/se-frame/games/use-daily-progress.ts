'use client';

import { useCallback, useEffect, useState } from 'react';

// Whether today's puzzle is finished on this device, and how it went. Kept in the browser only; a
// browser that refuses storage still plays, and the screen says it will not remember.

const KEY = 'se-daily-v1';

type Saved = { day: string; result: number };

function load(): Saved | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return parsed && typeof parsed.day === 'string' && typeof parsed.result === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export function useDailyProgress(day: string) {
  const [result, setResult] = useState<number | null>(null);
  const [notKept, setNotKept] = useState<string | null>(null);
  useEffect(() => {
    const saved = load();
    setResult(saved?.day === day ? saved.result : null);
  }, [day]);
  const finish = useCallback(
    (value: number) => {
      setResult(value);
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ day, result: value }));
      } catch (error) {
        setNotKept(error instanceof Error ? error.message : String(error));
      }
    },
    [day],
  );
  return { result, finish, notKept };
}
