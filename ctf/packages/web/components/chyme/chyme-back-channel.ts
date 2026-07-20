'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson, type CurrentUser } from './chyme-shared';
import type { ChymeBackChannelState, ChymeBackChannelJoinCredentials } from 'lib/chyme/types';

// Client controller for Back Channel (spec #1746). Polls the state endpoint on a short interval while
// the member is in a room, and owns the invite/accept/decline/hang-up actions plus the Stream join
// credentials for a live call. Kept UI-agnostic: the audio-room wires its return values into the tile
// button, the incoming toast/sheet, and the active-call panel.

// Poll cadence for an invite "ring": fast enough to feel like a ring, slow enough to be cheap. The
// server reaps stale rows on every read, so a lapsed invite disappears within one interval.
const BACK_CHANNEL_POLL_MS = 3000;
// Heartbeat cadence for a live call — comfortably inside CHYME_BACK_CHANNEL_CALL_TTL_SECONDS (90s).
const BACK_CHANNEL_HEARTBEAT_MS = 30000;

type AcceptResponse = { ok: true; callId: string } & ChymeBackChannelJoinCredentials;

const EMPTY_STATE: ChymeBackChannelState = { incomingInvite: null, outgoingInvite: null, activeCall: null };

export type BackChannelController = {
  incomingInvite: ChymeBackChannelState['incomingInvite'];
  outgoingInvite: ChymeBackChannelState['outgoingInvite'];
  activeCall: ChymeBackChannelState['activeCall'];
  // Join credentials for the current active call (null until minted). Matched to activeCall.callId.
  joinCredentials: (ChymeBackChannelJoinCredentials & { callId: string }) | null;
  busy: boolean;
  sendInvite: (recipientUserId: string) => Promise<void>;
  accept: (callId: string) => Promise<void>;
  decline: (callId: string) => Promise<void>;
  hangUp: (callId: string) => Promise<void>;
};

export function useBackChannel(currentUser: CurrentUser, enabled: boolean): BackChannelController {
  const [state, setState] = useState<ChymeBackChannelState>(EMPTY_STATE);
  const [joinCredentials, setJoinCredentials] = useState<(ChymeBackChannelJoinCredentials & { callId: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const joiningRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await requestJson<ChymeBackChannelState>('/api/chyme/back-channel/state');
      setState(next);
    } catch {
      /* best-effort poll; the next tick retries */
    }
  }, []);

  // Poll while enabled and the tab is visible (a hidden tab need not ring).
  useEffect(() => {
    if (!enabled) {
      setState(EMPTY_STATE);
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refresh();
    };
    tick();
    const id = window.setInterval(tick, BACK_CHANNEL_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  // When a call is active but we hold no credentials for it (the initiator, after the recipient
  // accepted), mint them once via /join. The recipient already got creds from /accept.
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
        const creds = await requestJson<AcceptResponse>('/api/chyme/back-channel/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ callId: active.callId }),
        });
        setJoinCredentials({
          callId: creds.callId,
          streamCallId: creds.streamCallId,
          streamApiKey: creds.streamApiKey,
          streamUserId: creds.streamUserId,
          streamToken: creds.streamToken,
        });
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
      void fetch('/api/chyme/back-channel/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ callId: active.callId }),
      }).catch(() => {
        /* best-effort */
      });
    };
    beat();
    const id = window.setInterval(beat, BACK_CHANNEL_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [state.activeCall]);

  const sendInvite = useCallback(async (recipientUserId: string) => {
    setBusy(true);
    try {
      await requestJson('/api/chyme/back-channel/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipientUserId }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const accept = useCallback(async (callId: string) => {
    setBusy(true);
    try {
      const creds = await requestJson<AcceptResponse>('/api/chyme/back-channel/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callId }),
      });
      setJoinCredentials({
        callId: creds.callId,
        streamCallId: creds.streamCallId,
        streamApiKey: creds.streamApiKey,
        streamUserId: creds.streamUserId,
        streamToken: creds.streamToken,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const decline = useCallback(async (callId: string) => {
    setBusy(true);
    try {
      await requestJson('/api/chyme/back-channel/decline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callId }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const hangUp = useCallback(async (callId: string) => {
    setBusy(true);
    try {
      await requestJson('/api/chyme/back-channel/leave', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callId }),
      });
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
