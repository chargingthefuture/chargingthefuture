'use client';

import { useEffect } from 'react';
import { reportError } from 'lib/observability/report';

const POLL_INTERVAL_MS = 15_000;

// While the admin has a live event open, read the public live endpoint every 15 seconds, as an open
// viewer page does. That read is what starts the public feed and recording when nothing is playing
// yet (lib/beacon/egress-kick.ts), so a phone broadcast gets them even when nobody else is watching
// and Stream's join webhook never arrives. The answer itself is not used here.
export function useBeaconLivePoll(liveEventId: string | null): void {
  useEffect(() => {
    if (!liveEventId) {
      return;
    }
    const poll = () => {
      fetch('/api/beacon/current', { cache: 'no-store' }).catch((error: unknown) => {
        reportError(error, { area: 'beacon', op: 'admin_live_poll', extra: { eventId: liveEventId } });
      });
    };
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [liveEventId]);
}
