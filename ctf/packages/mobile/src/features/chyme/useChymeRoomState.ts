// One room's state and actions, copied from the web shell's controller (web
// components/chyme/chyme-live-shell.tsx useChymeShellState): read the room and its chat, poll the
// room every 15 seconds while it is shown, refresh both on request, join, leave, send, edit and
// delete. Every call carries the room scope, so the main room and the private Weavers of the
// Commons room each have their own copy of this state.

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  deleteChymeMessage,
  getChymeMessages,
  getChymeRoom,
  postChymeJoin,
  postChymeLeave,
  postChymeMessage,
  readChymeRoom,
  type ChymeJoinResponse,
  type ChymeMessage,
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

// The first read: the room, then its chat. The private room answers 404 to a member who has not
// earned it, which becomes the explainer; any other failure is the error banner with no room.
function useRoomLoad(scope: ChymeRoomScope, setRoom: SetRoom, setMessages: (_m: ChymeMessage[]) => void, setError: SetError) {
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
        const messagePayload = await getChymeMessages(scope);
        if (!active) return;
        setRoom(roomPayload);
        setMessages(messagePayload.messages);
      } catch (loadError) {
        if (active) setError(messageOf(loadError, 'Unable to load Chyme.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [scope, setRoom, setMessages, setError]);
  return { loading, locked };
}

// Light room poll: while a room is shown, refresh just the room every 15s so raised hands, roles
// and the participant list stay current. Chat and the draft are untouched. A failed tick is ignored.
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

function useChatActions(scope: ChymeRoomScope, setMessages: Dispatch<SetStateAction<ChymeMessage[]>>, setError: SetError) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const payload = await postChymeMessage(text, scope);
      setMessages((current) => [...current, payload.message]);
      setDraft('');
    } catch (sendError) {
      setError(messageOf(sendError, 'Unable to send message.'));
    } finally {
      setSending(false);
    }
  }, [scope, draft, sending, setMessages, setError]);

  // Optimistic remove, then DELETE; restored in time order on failure. Author-only on the server.
  const remove = useCallback(async (messageId: string) => {
    let removed: ChymeMessage | undefined;
    setMessages((current) => {
      removed = current.find((m) => m.id === messageId);
      return current.filter((m) => m.id !== messageId);
    });
    try {
      await deleteChymeMessage(messageId, scope);
    } catch (deleteError) {
      const restored = removed;
      if (restored) {
        setMessages((current) => [...current, restored].sort((a, b) => a.sentAtIso.localeCompare(b.sentAtIso)));
      }
      setError(messageOf(deleteError, 'Unable to delete your message.'));
    }
  }, [scope, setMessages, setError]);

  // Edit = delete + repost: the text goes back into the composer and the original is deleted.
  const edit = useCallback((messageId: string, text: string) => {
    setDraft(text);
    void remove(messageId);
  }, [remove]);

  return { draft, setDraft, sending, send, remove, edit };
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
  const [messages, setMessages] = useState<ChymeMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Closed until the member presses Chat, as on the web.
  const [showChat, setShowChat] = useState(false);
  const setRoom = useCallback((r: ChymeRoomResponse) => setRoomState(r), []);

  const { loading, locked } = useRoomLoad(scope, setRoom, setMessages, setError);
  useRoomPoll(scope, room !== null, setRoom);
  const chat = useChatActions(scope, setMessages, setError);
  const call = useCallActions(scope, setRoom, setError);

  // Refresh the room (live state and count) and the chat together; the spinner shows the press.
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const [roomPayload, messagePayload] = await Promise.all([getChymeRoom(scope), getChymeMessages(scope)]);
      setRoom(roomPayload);
      setMessages(messagePayload.messages);
    } catch (refreshError) {
      setError(messageOf(refreshError, 'Unable to refresh the room.'));
    } finally {
      setRefreshing(false);
    }
  }, [scope, refreshing, setRoom]);

  return { room, messages, error, loading, locked, refreshing, refresh, showChat, setShowChat, chat, call };
}

export type ChymeRoomState = ReturnType<typeof useChymeRoomState>;
