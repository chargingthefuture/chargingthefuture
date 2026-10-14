/**
 * All Beacon Admin state, data loading and actions, ported from useBeaconAdmin in the web admin page
 * (components/beacon/beacon-admin-shell.tsx) with the same steps, notices and error lines. The
 * actions live in useBeaconAdminActions.ts.
 *
 * One addition the app needs: opening an event that is already live fetches its broadcast details
 * (GET ingest), so the host can broadcast to it again from this phone after leaving the screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { getBeaconCurrent, type BeaconChatCredentials, type BeaconHostCredentials } from './BeaconApi';
import { loadBeaconAdminEvents, loadBeaconIngest, type BeaconAdminEvent, type BeaconIngest } from './BeaconAdminApi';
import { useBeaconAdminActions } from './useBeaconAdminActions';
import { reportError } from '../../observability/report';

const LIVE_POLL_MS = 15000;

// While a live event is open, read the public live endpoint every 15 seconds, as the web admin page
// does: that read is what starts the public feed and recording when nothing is playing yet.
function useBeaconLivePoll(liveEventId: string | null): void {
  useEffect(() => {
    if (!liveEventId) return;
    const poll = () => {
      getBeaconCurrent().catch((error: unknown) => {
        reportError(error, { area: 'beacon', op: 'admin_live_poll', extra: { eventId: liveEventId } });
      });
    };
    poll();
    const timer = setInterval(poll, LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [liveEventId]);
}

export type BeaconAdminState = ReturnType<typeof useBeaconAdmin>;

export function useBeaconAdmin() {
  const [events, setEvents] = useState<BeaconAdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [ingest, setIngest] = useState<BeaconIngest | null>(null);
  const [host, setHost] = useState<BeaconHostCredentials | null>(null);
  const [chat, setChat] = useState<BeaconChatCredentials | null>(null);

  const loadEvents = useCallback(async () => {
    setEvents(await loadBeaconAdminEvents());
  }, []);

  // Refresh the list after an action. The action itself already said whether it worked, so a failed
  // refresh is reported rather than shown over the notice.
  const refreshEvents = useCallback(async () => {
    try {
      await loadEvents();
    } catch (refreshError) {
      reportError(refreshError, { area: 'beacon', op: 'admin_events_refresh' });
    }
  }, [loadEvents]);

  useEffect(() => {
    void (async () => {
      try {
        await loadEvents();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load the admin data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadEvents]);

  const activeEvent = events.find((event) => event.id === activeEventId) ?? null;
  useBeaconLivePoll(activeEvent?.status === 'live' ? activeEvent.id : null);

  // Open an event from the history list. A live one also gets its broadcast details, so this phone
  // can broadcast to it.
  const openEvent = useCallback(async (eventId: string) => {
    setActiveEventId(eventId);
    const event = events.find((candidate) => candidate.id === eventId);
    if (event?.status !== 'live' || host) return;
    try {
      const data = await loadBeaconIngest(eventId);
      setIngest(data);
      setHost(data);
    } catch (ingestError) {
      setError(ingestError instanceof Error ? ingestError.message : 'Broadcast input is unavailable.');
    }
  }, [events, host]);

  const actions = useBeaconAdminActions({
    setError, setNotice, setActiveEventId, setIngest, setHost, setChat, refreshEvents,
  });

  return { events, loading, error, notice, activeEvent, activeEventId, ingest, host, chat, openEvent, ...actions };
}
