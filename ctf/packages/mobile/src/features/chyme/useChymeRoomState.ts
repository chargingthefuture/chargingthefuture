// One room's state and actions, copied from the web shell's controller (web
// components/chyme/chyme-live-shell.tsx useChymeShellState): read the room, poll it every 15
// seconds while it is shown, refresh it on request, join and leave. Every call carries the room scope, so the main room and the private Weavers of the
// Commons room each have their own copy of this state.

import { useCallback, useEffect, useState } from 'react';
import {
  getChymeRoom,
  postChymeJoin,
  postChymeLeave,
  readChymeRoom,
  type ChymeJoinResponse,
  type ChymeRoomResponse,
  type ChymeRoomScope,
} from './ChymeApi';

export type JoinState = 'idle' | 'joining' | 'ready';

// What the live call is doing, as the Stream SDK reports it, for the Join pill (web
// ChymeConnectionState): joined, trying to reconnect, or given up.
export type ChymeConnectionState = 'joined' | 'reconnecting' | 'lost';

type SetError = (_e: string | null) => void;
type SetRoom = (_r: ChymeRoomResponse) => void;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// The first read. The private room answers 404 to a member who has not
// earned it, which becomes the explainer; any other failure is the error banner with no room.
function useRoomLoad(scope: ChymeRoomScope, setRoom: SetRoom, setError: SetError) {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const roomPayload = await readChymeRoom(scope);
        if (roomPayload === 'locked') {
          if (active) setLocked(true);
          return;
        }
        if (!active) return;
        setRoom(roomPayload);
      } catch (loadError) {
        if (active) setError(messageOf(loadError, 'Unable to load Chyme.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [scope, setRoom, setError]);
  return { loading, locked };
}

// Light room poll: while a room is shown, refresh just the room every 15s so raised hands, roles
// and the participant list stay current. A failed tick is ignored.
function useRoomPoll(scope: ChymeRoomScope, roomLoaded: boolean, setRoom: SetRoom) {
  useEffect(() => {
    if (!roomLoaded) return;
    let active = true;
    const intervalId = setInterval(() => {
      void getChymeRoom(scope)
        .then((payload) => {
          if (active) setRoom(payload);
        })
        .catch(() => {
          /* no-trace: best-effort, the next tick retries */
        });
    }, 15000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [scope, roomLoaded, setRoom]);
}

function useCallActions(scope: ChymeRoomScope, setRoom: SetRoom, setError: SetError) {
  const [joinState, setJoinState] = useState<JoinState>('idle');
  const [joinInfo, setJoinInfo] = useState<ChymeJoinResponse | null>(null);
  const [connection, setConnection] = useState<ChymeConnectionState>('joined');

  const join = useCallback(async () => {
    setJoinState('joining');
    setConnection('joined');
    setError(null);
    try {
      const payload = await postChymeJoin(scope);
      setJoinInfo(payload);
      setJoinState('ready');
      setRoom(await getChymeRoom(scope));
    } catch (joinError) {
      setJoinState('idle');
      setError(messageOf(joinError, 'Unable to join Chyme call.'));
    }
  }, [scope, setRoom, setError]);

  // Unmount the call first, then drop presence so the member stops counting at once, then re-read.
  const leave = useCallback(async () => {
    setJoinState('idle');
    setJoinInfo(null);
    try {
      await postChymeLeave(scope);
    } catch {
      /* no-trace: best-effort, the presence window drops the member anyway */
    }
    try {
      setRoom(await getChymeRoom(scope));
    } catch {
      /* no-trace: a transient refresh failure is ignored */
    }
  }, [scope, setRoom]);

  return { joinState, joinInfo, connection, setConnection, join, leave };
}

export function useChymeRoomState(scope: ChymeRoomScope) {
  const [room, setRoomState] = useState<ChymeRoomResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const setRoom = useCallback((r: ChymeRoomResponse) => setRoomState(r), []);

  const { loading, locked } = useRoomLoad(scope, setRoom, setError);
  useRoomPoll(scope, room !== null, setRoom);
  const call = useCallActions(scope, setRoom, setError);

  // Refresh the room (live state and count); the spinner shows the press.
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      setRoom(await getChymeRoom(scope));
    } catch (refreshError) {
      setError(messageOf(refreshError, 'Unable to refresh the room.'));
    } finally {
      setRefreshing(false);
    }
  }, [scope, refreshing, setRoom]);

  return { room, error, loading, locked, refreshing, refresh, call };
}

export type ChymeRoomState = ReturnType<typeof useChymeRoomState>;
