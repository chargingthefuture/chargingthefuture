'use client';

import { useEffect, useRef } from 'react';

// Best-effort "keep participating" for a web audio call — the closest a browser gets to the native
// Android background service (which uses a foreground service to survive app-switching and screen
// lock). This does NOT survive locking the phone or switching apps: no web API can hold a live WebRTC
// call in a fully backgrounded page. What it does, while the tab is foreground, is:
//
//   1. Screen Wake Lock — hold the display awake so it does not sleep. A sleeping screen suspends the
//      page, which drops the call; keeping it awake is the single biggest lever web has. The lock is
//      automatically released by the browser whenever the page is hidden, so we re-acquire it every
//      time the page becomes visible again.
//   2. Media Session — publish metadata + a 'playing' state so the OS/browser treats this as active
//      media (media-key / lock-screen presence) and keeps the audio prioritized.
//
// Everything is feature-detected and no-ops where unsupported (older Safari, etc.). Pass `active`
// true only while actually in the call (e.g. Stream status === 'joined').

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> };
type WakeLockLike = { request: (type: 'screen') => Promise<WakeLockSentinelLike> };

function getWakeLock(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  // Cast through unknown so we don't clash with (or depend on) the lib.dom WakeLock typing, which
  // varies by TS version and is not present in every browser.
  const wl = (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock;
  return wl ?? null;
}

export function useAudioCallKeepAlive(active: boolean, title = 'Chyme audio room'): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    let canceled = false;

    const acquire = async () => {
      const wl = getWakeLock();
      if (!wl || sentinelRef.current) return;
      try {
        const sentinel = await wl.request('screen');
        if (canceled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // Request can reject when the page isn't visible or the user denied it — best effort only.
      }
    };

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
    };

    // The wake lock auto-releases when the page is hidden; re-acquire once it's visible again.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    // Media Session presence (feature-detected).
    const mediaSession = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (mediaSession && typeof MediaMetadata !== 'undefined') {
      try {
        mediaSession.metadata = new MediaMetadata({ title, artist: 'Survivor Hub' });
        mediaSession.playbackState = 'playing';
      } catch {
        // Some browsers throw on unsupported metadata fields — ignore.
      }
    }

    return () => {
      canceled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
      if (mediaSession) {
        try {
          mediaSession.playbackState = 'none';
          mediaSession.metadata = null;
        } catch {
          // ignore
        }
      }
    };
  }, [active, title]);
}
