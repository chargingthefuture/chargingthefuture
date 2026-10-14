// Loads the goal board and runs one action at a time against it, reloading after every action so
// the screen matches what the server now holds. Same as the web's useBoard (pp-goals-tab.tsx).
import { useCallback, useEffect, useRef, useState } from 'react';
import { failureOf, loadBoard, type ActionResult, type Board } from './PeerProgrammingApi';

export function useGoalBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      const loaded = await loadBoard();
      if (mounted.current) setBoard(loaded);
    } catch (loadError) {
      if (mounted.current) setError(loadError instanceof Error ? loadError.message : 'The goal board could not be loaded.');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const run = useCallback(async (action: () => Promise<ActionResult>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const result = await action();
    const failure = failureOf(result);
    if (failure && mounted.current) setError(failure);
    await reload();
    if (mounted.current) setBusy(false);
    return result.ok;
  }, [reload]);

  return { board, error, busy, run };
}
