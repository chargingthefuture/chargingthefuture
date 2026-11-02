// Which puzzles this phone has solved, kept in the app's own files only, the Android copy of the
// web's use-solved.ts. A file that cannot be read starts empty; one that cannot be written is said.

import { useCallback, useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';

function store(): File {
  return new File(Paths.document, 'se-games-solved.json');
}

function parse(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function useSolved() {
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  const [notKept, setNotKept] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const file = store();
    if (!file.exists) return;
    file
      .text()
      .then((raw) => {
        if (active) setSolved(new Set(parse(raw)));
      })
      .catch((error: unknown) => {
        if (active) setNotKept(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);
  const markSolved = useCallback((slug: string) => {
    setSolved((current) => {
      if (current.has(slug)) return current;
      const next = new Set(current).add(slug);
      try {
        const file = store();
        if (!file.exists) file.create();
        file.write(JSON.stringify([...next]));
      } catch (error) {
        setNotKept(error instanceof Error ? error.message : String(error));
      }
      return next;
    });
  }, []);
  return { solved, markSolved, notKept };
}
