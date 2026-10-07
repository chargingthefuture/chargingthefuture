// Loads GET /api/peer-programming/room (the week's topic, the member's cohort and its roster, the
// chat messages and the viewer's access) and reloads it on request.
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadRoom, type Room } from './PeerProgrammingApi';

export function useRoom() {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      const loaded = await loadRoom();
      if (!mounted.current) return;
      setRoom(loaded);
      setError(null);
    } catch (loadError) {
      if (mounted.current) setError(loadError instanceof Error ? loadError.message : 'The PeerProgramming room could not be loaded.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return { room, loading, error, setError, reload };
}
