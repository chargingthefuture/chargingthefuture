// Loads GET /api/peer-programming/room (the week's topic, the open cohort and its roster, the
// messages, the viewer's access, the running cohorts and the member's own) and keeps it current, the
// same as the web shell (web components/peer-programming/peer-programming-shell.tsx): reload the open
// cohort, open another cohort to listen in, and post to the Direct Line. Only the newest request
// settles, so two quick cohort switches can never land in the wrong order.
import { useCallback, useEffect, useRef, useState } from 'react';
import { failureOf, loadRoom, postMessage, type Room } from './PeerProgrammingApi';

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// `initialCohortId` opens a given cohort first, as the web's ?cohortId= link does (null: the member's own).
export function useRoom(initialCohortId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which cohort is open. null is the member's own cohort.
  const [activeCohortId, setActiveCohortId] = useState<string | null>(initialCohortId);
  const [switching, setSwitching] = useState(false);
  const mounted = useRef(true);
  const latest = useRef(0);

  // Load one cohort's room; true when this request is still the newest and it settled.
  const load = useCallback(async (cohortId: string | null, fallback: string): Promise<boolean> => {
    const request = ++latest.current;
    try {
      const loaded = await loadRoom(cohortId);
      if (!mounted.current || request !== latest.current) return false;
      setRoom(loaded);
      return true;
    } catch (loadError) {
      if (mounted.current && request === latest.current) setError(messageOf(loadError, fallback));
      return false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load(initialCohortId, 'Failed to load PeerProgramming data.').finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => {
      mounted.current = false;
    };
  }, [load, initialCohortId]);

  const reload = useCallback(async () => {
    await load(activeCohortId, 'Failed to refresh PeerProgramming data.');
  }, [load, activeCohortId]);

  // Open another running cohort read-only; true when it opened.
  const openCohort = useCallback(async (cohortId: string): Promise<boolean> => {
    setSwitching(true);
    setError(null);
    const opened = await load(cohortId, 'Failed to open that cohort.');
    if (opened) setActiveCohortId(cohortId);
    if (mounted.current) setSwitching(false);
    return opened;
  }, [load]);

  // Post to the open cohort, then re-pull the room, which is the source of truth for its messages.
  const send = useCallback(async (body: string): Promise<boolean> => {
    if (!body.trim()) return false;
    const cohortId = room?.cohort?.id;
    if (!cohortId) {
      setError('You are not in a cohort yet.');
      return false;
    }
    if (room?.access !== 'member') {
      setError('You are listening in — only cohort members can post here.');
      return false;
    }
    setError(null);
    const failure = failureOf(await postMessage(cohortId, body));
    if (failure) {
      if (mounted.current) setError(failure);
      return false;
    }
    await load(activeCohortId, 'Failed to refresh PeerProgramming data.');
    return true;
  }, [room, load, activeCohortId]);

  return { room, loading, error, activeCohortId, switching, reload, openCohort, send };
}
