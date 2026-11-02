// Whether today's puzzle is finished on this phone, and how it went, kept in the app's own files,
// the Android copy of the web's use-daily-progress.ts.

import { useCallback, useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';

function store(): File {
  return new File(Paths.document, 'se-daily-v1.json');
}

function parse(raw: string): { day: string; result: number } | null {
  try {
    const value = JSON.parse(raw) as { day?: unknown; result?: unknown };
    return typeof value.day === 'string' && typeof value.result === 'number' ? { day: value.day, result: value.result } : null;
  } catch {
    return null;
  }
}

export function useDailyProgress(day: string) {
  const [result, setResult] = useState<number | null>(null);
  const [notKept, setNotKept] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const file = store();
    if (!file.exists) return;
    file
      .text()
      .then((raw) => {
        const saved = parse(raw);
        if (active && saved?.day === day) setResult(saved.result);
      })
      .catch((error: unknown) => {
        if (active) setNotKept(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [day]);
  const finish = useCallback(
    (value: number) => {
      setResult(value);
      try {
        const file = store();
        if (!file.exists) file.create();
        file.write(JSON.stringify({ day, result: value }));
      } catch (error) {
        setNotKept(error instanceof Error ? error.message : String(error));
      }
    },
    [day],
  );
  return { result, finish, notKept };
}
