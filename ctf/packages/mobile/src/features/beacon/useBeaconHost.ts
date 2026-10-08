/**
 * The admin's go-live state for the Beacon screen, following the web admin page's steps
 * (useBeaconAdmin in components/beacon/beacon-admin-shell.tsx) and its notice and error lines:
 *   Create draft → the draft becomes the event in the Broadcast card.
 *   Go live      → set up the call and fetch the host's credentials (GET ingest), then take the call
 *                  out of backstage (go-live, which posts "live now" to the Commons).
 *   End broadcast → leave the call, then end the event.
 * An event already live when the screen opens (started here or on the web) is picked up and its host
 * credentials fetched, so the host can broadcast to it again from this phone.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  createBeaconEvent,
  endBeaconEvent,
  getBeaconHostCredentials,
  goLiveBeaconEvent,
  listBeaconAdminEvents,
  type BeaconEventLike,
  type BeaconHostCredentials,
} from './BeaconApi';

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useBeaconHost(onChanged: () => void) {
  const [activeEvent, setActiveEvent] = useState<BeaconEventLike | null>(null);
  const [host, setHost] = useState<BeaconHostCredentials | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const live = (await listBeaconAdminEvents()).find((event) => event.status === 'live') ?? null;
        if (!live) return;
        setActiveEvent(live);
        setHost(await getBeaconHostCredentials(live.id));
      } catch (loadError) {
        setError(messageOf(loadError, 'Could not load the admin data.'));
      }
    })();
  }, []);

  const createEvent = useCallback(async () => {
    if (title.trim().length === 0) {
      setError('Add a title first.');
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const event = await createBeaconEvent(title.trim(), description.trim());
      setNotice('Event created.');
      setTitle('');
      setDescription('');
      setHost(null);
      setActiveEvent(event);
    } catch (createError) {
      setError(messageOf(createError, 'Could not create the event.'));
    } finally {
      setCreating(false);
    }
  }, [title, description]);

  const goLive = useCallback(async (event: BeaconEventLike) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const credentials = await getBeaconHostCredentials(event.id);
      await goLiveBeaconEvent(event.id);
      setNotice('You are live. A "live now" notice was posted to the Commons.');
      setHost(credentials);
      setActiveEvent({ ...event, status: 'live' });
    } catch (goLiveError) {
      setError(messageOf(goLiveError, 'Could not start the broadcast.'));
    } finally {
      setBusy(false);
      onChanged();
    }
  }, [onChanged]);

  const endEvent = useCallback(async (event: BeaconEventLike) => {
    setBusy(true);
    setError(null);
    // Leave the call first, so the phone stops sending before the event ends.
    setHost(null);
    try {
      await endBeaconEvent(event.id);
      setNotice('Broadcast ended. The replay posts to the Commons when the recording is ready.');
      setActiveEvent({ ...event, status: 'ended' });
    } catch (endError) {
      setError(messageOf(endError, 'Could not end the broadcast.'));
    } finally {
      setBusy(false);
      onChanged();
    }
  }, [onChanged]);

  return { activeEvent, host, title, setTitle, description, setDescription, creating, busy, error, notice, createEvent, goLive, endEvent };
}
