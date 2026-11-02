'use client';

import { useCallback, useEffect, useState } from 'react';

// Which puzzles this device has solved, kept in the browser only. Storage that is refused (a private
// window, blocked site data) leaves the game working with nothing remembered.

const KEY = 'se-games-solved';

function load(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function useSolved() {
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  const [notKept, setNotKept] = useState<string | null>(null);
  useEffect(() => setSolved(new Set(load())), []);
  const markSolved = useCallback((slug: string) => {
    setSolved((current) => {
      if (current.has(slug)) return current;
      const next = new Set(current).add(slug);
      try {
        window.localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch (error) {
        // Not remembered on this device; the game still plays, and the screen says why.
        setNotKept(error instanceof Error ? error.message : String(error));
      }
      return next;
    });
  }, []);
  return { solved, markSolved, notKept };
}
