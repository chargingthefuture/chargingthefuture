'use client';

import { useEffect } from 'react';
import type { Call } from '@stream-io/video-react-sdk';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';

type HeartbeatOptions = {
  joined: boolean;
  call: Call | null;
  // The room-scope query (`?room=contributors`, or empty for the main room).
  scopeQuery: string;
  // A refusal every later beat would share: an admin removed the member, or they dropped out of
  // the count and the room is now at its cap.
  onStopped: (message: string) => void;
};

// While joined AND the tab is visible, ping the presence heartbeat so this member keeps counting as
// in the call. A backgrounded/forgotten tab stops pinging, so it stops writing to the DB and drops out
// of presence after the server's freshness window — which also lets the database compute go idle
// instead of being pinned awake by an open tab.
//
// Each beat carries whether the microphone is on, and a change of microphone beats at once, so a
// member who has not joined yet sees who is muted (owner decision, 2026-10-16).
export function useChymeHeartbeat({ joined, call, scopeQuery, onStopped }: HeartbeatOptions): void {
  useEffect(() => {
    if (!joined) return;
    const ping = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void fetch(`/api/chyme/heartbeat${scopeQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ micOn: call?.microphone.state.status === 'enabled' }),
      })
        .then(async (res) => {
          if (res.ok) return;
          // Every later beat would be refused too, so stop beating and show its reason in place of
          // the stage (with Leave), as a join refusal is.
          const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
          if (body?.code === CHYME_ERROR_CODE.removedFromRoom || body?.code === CHYME_ERROR_CODE.roomFull) {
            onStopped(body.message ?? 'The room did not keep you in the call.');
          }
        })
        .catch(() => {
          /* best-effort keepalive */
        });
    };
    ping();
    // 35s keeps a visible member comfortably inside the 45s presence window (CHYME_PRESENCE_TTL_SECONDS)
    // while cutting the write rate vs the old 20s.
    const intervalId = window.setInterval(ping, 35000);
    // Ping immediately when the member returns to the tab, so they re-appear without waiting.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // The observable repeats the current status on subscribe; only a change beats.
    let lastMic = call?.microphone.state.status;
    const micSubscription = call?.microphone.state.status$.subscribe((next) => {
      if (next === lastMic) return;
      lastMic = next;
      ping();
    });
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      micSubscription?.unsubscribe();
    };
  }, [joined, call, scopeQuery, onStopped]);
}
