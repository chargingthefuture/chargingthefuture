// Start the public HLS feed and the recording once the host is actually sending something: the
// camera and microphone, or the phone's screen. Go Live only takes the call out of backstage; the
// feed and recording have to start once media exists, which is when `publishing` turns true. Fires
// once per publishing stretch and resets when the host stops, so starting again retries.
//
// Stream refuses to start either until the host's first track has reached it, which can take a
// second or two after joining, so a refusal is retried. Returns the error to show when every
// attempt was refused, so the host is not told they are live while nothing public has started.
// The web admin page does the same (ctf/packages/web/components/beacon/use-beacon-egress-start.ts).
import { useEffect, useRef, useState } from 'react';
import { startBeaconBroadcast } from './BeaconApi';

const START_ATTEMPTS = 4;
const START_RETRY_MS = 3000;

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
        try {
          await startBeaconBroadcast(eventId);
          reason = null;
          break;
        } catch (startError) {
          reason = startError instanceof Error ? startError.message : String(startError);
        }
      }
      finished = true;
      if (!canceled && reason) {
        setError(`The public broadcast and recording did not start: ${reason}`);
      }
    })();
    return () => {
      canceled = true;
      // Cut off part-way (an unmount): let the next run start over rather than believe the start
      // already happened.
      if (!finished) {
        startedRef.current = false;
      }
    };
  }, [publishing, eventId]);

  return error;
}
