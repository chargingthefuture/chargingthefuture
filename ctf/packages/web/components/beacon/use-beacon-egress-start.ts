'use client';

import { useEffect, useRef, useState } from 'react';
import { reportError } from 'lib/observability/report';

// How many times the browser asks for the public feed and recording to start, and how far apart.
// Stream refuses to start either until the host's first track has reached it, which can take a
// second or two after joining, so one refusal right after joining is expected and retried.
const START_ATTEMPTS = 4;
const START_RETRY_MS = 3_000;

async function requestStart(eventId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/beacon/${eventId}/start-broadcast`, {
      method: 'POST',
      headers: { 'x-ctf-csrf': '1' },
    });
    if (res.ok) {
      return null;
    }
    // A refusal (Stream, CSRF or origin) resolves normally, so it has to be read here.
    const data = (await res.json().catch((parseError: unknown) => {
      reportError(parseError, { area: 'beacon', op: 'start_broadcast_client_body', extra: { eventId, status: res.status } });
      return null;
    })) as { message?: string; code?: string } | null;
    reportError(new Error(`start-broadcast refused: ${data?.code ?? res.status}`), {
      area: 'beacon',
      op: 'start_broadcast_client',
      extra: { eventId, status: res.status },
    });
    return data?.message ?? `the server answered ${res.status}`;
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'start_broadcast_client', extra: { eventId } });
    return error instanceof Error ? error.message : 'the request did not reach the server';
  }
}

// Start the public HLS feed and the recording once the host is actually sending something: the
// camera and microphone, or a shared screen. Go Live only takes the call out of backstage; the feed
// and recording have to start once media exists, which is when `publishing` turns true. Fires once
// per publishing stretch and resets when the host stops, so starting again retries.
//
// Returns the error to show when every attempt was refused, so the host is not told they are live
// to viewers while no public feed or recording has started.
export function useBeaconEgressStart(eventId: string, publishing: boolean): string | null {
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publishing) {
      startedRef.current = false;
      setError(null);
      return;
    }
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    let canceled = false;
    let finished = false;
    void (async () => {
      let reason: string | null = null;
      for (let attempt = 0; attempt < START_ATTEMPTS && !canceled; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, START_RETRY_MS));
        }
        reason = await requestStart(eventId);
        if (!reason) {
          break;
        }
      }
      finished = true;
      if (!canceled && reason) {
        setError(`The public broadcast and recording did not start: ${reason}`);
      }
    })();
    return () => {
      canceled = true;
      // Cut off part-way (an unmount, or React running the effect twice in development): let the
      // next run start over rather than believe the start already happened.
      if (!finished) {
        startedRef.current = false;
      }
    };
  }, [publishing, eventId]);

  return error;
}
