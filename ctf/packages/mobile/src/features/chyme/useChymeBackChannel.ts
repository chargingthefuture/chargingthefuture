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
  sendInvite: (recipientUserId: string) => Promise<void>;
  accept: (callId: string) => Promise<void>;
  decline: (callId: string) => Promise<void>;
  hangUp: (callId: string) => Promise<void>;
};

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
  const joiningRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getBackChannelState());
    } catch {
      /* best-effort poll; next tick retries */
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY_STATE);
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void refresh();
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
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
      } catch {
        joiningRef.current = null;
      }
    })();
  }, [state.activeCall, joinCredentials?.callId]);

  // Heartbeat the live call so it is not reaped.
  useEffect(() => {
    const active = state.activeCall;
    if (!active) return;
    const beat = () => {
      void postBackChannelHeartbeat(active.callId).catch(() => {
        /* best-effort */
      });
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [state.activeCall]);

  const sendInvite = useCallback(async (recipientUserId: string) => {
    setBusy(true);
    try {
      await postBackChannelInvite(recipientUserId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const accept = useCallback(async (callId: string) => {
    setBusy(true);
    try {
      setJoinCredentials(toCreds(await postBackChannelAccept(callId)));
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const decline = useCallback(async (callId: string) => {
    setBusy(true);
    try {
      await postBackChannelDecline(callId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const hangUp = useCallback(async (callId: string) => {
    setBusy(true);
    try {
      await postBackChannelLeave(callId);
      setJoinCredentials(null);
      await refresh();
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
    sendInvite,
    accept,
    decline,
    hangUp,
  };
}
