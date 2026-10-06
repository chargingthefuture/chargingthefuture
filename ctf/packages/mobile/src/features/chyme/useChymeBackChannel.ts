import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getBackChannelState,
  postBackChannelInvite,
  postBackChannelAccept,
  postBackChannelJoin,
  postBackChannelDecline,
  postBackChannelLeave,
  postBackChannelHeartbeat,
  type ChymeBackChannelState,
  type ChymeBackChannelJoinResponse,
} from './ChymeApi';

// React Native controller for Back Channel (spec #1746), the mirror of the web hook. Polls the state
// endpoint on a short interval while in the room, and owns invite/accept/decline/hang-up plus the
// Stream join credentials for a live call. No document.visibilityState guard (there is no RN
// equivalent); while in a call the Android foreground service keeps this JS runtime alive when
// backgrounded, so the poll and heartbeat keep firing.

const POLL_MS = 3000;
const HEARTBEAT_MS = 30000;

const EMPTY_STATE: ChymeBackChannelState = { incomingInvite: null, outgoingInvite: null, activeCall: null };

export type JoinCredentials = {
  callId: string;
  streamCallId: string;
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

export type MobileBackChannelController = {
  incomingInvite: ChymeBackChannelState['incomingInvite'];
  outgoingInvite: ChymeBackChannelState['outgoingInvite'];
  activeCall: ChymeBackChannelState['activeCall'];
  joinCredentials: JoinCredentials | null;
  busy: boolean;
  // The reason the last invite, accept, decline, hang-up or /join failed, in the route's own words.
  // Cleared when the next action starts and when the member dismisses it.
  error: string | null;
  clearError: () => void;
  sendInvite: (_recipientUserId: string) => Promise<void>;
  accept: (_callId: string) => Promise<void>;
  decline: (_callId: string) => Promise<void>;
  hangUp: (_callId: string) => Promise<void>;
};

// "Could not send the invite: This room is not live." — what failed, then the route's reason.
function describeFailure(what: string, error: unknown): string {
  const reason = error instanceof Error && error.message ? error.message : 'no reason was given.';
  return `Could not ${what}: ${reason}`;
}

function toCreds(resp: ChymeBackChannelJoinResponse): JoinCredentials {
  return {
    callId: resp.callId,
    streamCallId: resp.streamCallId,
    streamApiKey: resp.streamApiKey,
    streamUserId: resp.streamUserId,
    streamToken: resp.streamToken,
  };
}

export function useChymeBackChannel(enabled: boolean): MobileBackChannelController {
  const [state, setState] = useState<ChymeBackChannelState>(EMPTY_STATE);
  const [joinCredentials, setJoinCredentials] = useState<JoinCredentials | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);
  const joiningRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getBackChannelState());
    } catch {
      /* no-trace: best-effort poll, the next tick retries */
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY_STATE);
      return;
    }
    let canceled = false;
    const tick = () => {
      if (canceled) return;
      void refresh();
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      canceled = true;
      clearInterval(id);
    };
  }, [enabled, refresh]);

  // Initiator mints creds via /join once the call goes active (the recipient got creds from /accept).
  useEffect(() => {
    const active = state.activeCall;
    if (!active) {
      setJoinCredentials(null);
      joiningRef.current = null;
      return;
    }
    if (joinCredentials?.callId === active.callId) return;
    if (joiningRef.current === active.callId) return;
    joiningRef.current = active.callId;
    void (async () => {
      try {
        setJoinCredentials(toCreds(await postBackChannelJoin(active.callId)));
      } catch (joinError) {
        joiningRef.current = null;
        setError(describeFailure('connect to the Back Channel', joinError));
      }
    })();
  }, [state.activeCall, joinCredentials?.callId]);

  // Heartbeat the live call so it is not reaped. Keyed on the call id, not the activeCall object:
  // every 3-second poll parses a fresh object, and depending on it would restart this effect (and
  // send a beat) on every poll instead of every 30 seconds.
  const activeCallId = state.activeCall?.callId ?? null;
  useEffect(() => {
    if (!activeCallId) return;
    const beat = () => {
      void postBackChannelHeartbeat(activeCallId).catch(() => {
        /* best-effort */
      });
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [activeCallId]);

  const sendInvite = useCallback(async (recipientUserId: string) => {
    setBusy(true);
    setError(null);
    try {
      await postBackChannelInvite(recipientUserId);
      await refresh();
    } catch (actionError) {
      setError(describeFailure('send the Back Channel invite', actionError));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const accept = useCallback(async (callId: string) => {
    setBusy(true);
    setError(null);
    try {
      setJoinCredentials(toCreds(await postBackChannelAccept(callId)));
      await refresh();
    } catch (actionError) {
      setError(describeFailure('accept the Back Channel', actionError));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const decline = useCallback(async (callId: string) => {
    setBusy(true);
    setError(null);
    try {
      await postBackChannelDecline(callId);
      await refresh();
    } catch (actionError) {
      setError(describeFailure('decline the Back Channel', actionError));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const hangUp = useCallback(async (callId: string) => {
    setBusy(true);
    setError(null);
    try {
      await postBackChannelLeave(callId);
      setJoinCredentials(null);
      await refresh();
    } catch (actionError) {
      setError(describeFailure('hang up the Back Channel', actionError));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return {
    incomingInvite: state.incomingInvite,
    outgoingInvite: state.outgoingInvite,
    activeCall: state.activeCall,
    joinCredentials,
    busy,
    error,
    clearError,
    sendInvite,
    accept,
    decline,
    hangUp,
  };
}
