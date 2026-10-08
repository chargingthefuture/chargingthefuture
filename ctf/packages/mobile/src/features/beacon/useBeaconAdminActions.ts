/**
 * The Beacon Admin actions, ported from the web admin page's useBeaconAdmin
 * (components/beacon/beacon-admin-shell.tsx): create a draft, delete a draft in two steps, go live,
 * end, moderate the chat, and copy the broadcaster-app address or stream key. Same order of steps,
 * same notices, same error lines.
 */
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import * as Clipboard from 'expo-clipboard';
import { getBeaconChatCredentials, type BeaconChatCredentials, type BeaconHostCredentials } from './BeaconApi';
import { adminMutate, loadBeaconIngest, type BeaconAdminEvent, type BeaconIngest, type BeaconModerationAction } from './BeaconAdminApi';
import { reportError } from '../../observability/report';

type Setters = {
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setActiveEventId: Dispatch<SetStateAction<string | null>>;
  setIngest: Dispatch<SetStateAction<BeaconIngest | null>>;
  setHost: Dispatch<SetStateAction<BeaconHostCredentials | null>>;
  setChat: Dispatch<SetStateAction<BeaconChatCredentials | null>>;
  refreshEvents: () => Promise<void>;
};

export function useBeaconAdminActions(s: Setters) {
  const { setError, setNotice, setActiveEventId, setIngest, setHost, setChat, refreshEvents } = s;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [moderateTarget, setModerateTarget] = useState('');
  // Two-step delete: the first press arms this id and turns the button into "Confirm delete".
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createEvent = useCallback(async () => {
    if (title.trim().length === 0) {
      setError('Add a title first.');
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    const result = await adminMutate<{ event: BeaconAdminEvent }>('/api/beacon', 'POST', { title: title.trim(), description: description.trim() });
    if (!result.ok || !result.data) {
      setError(result.message ?? 'Could not create the event.');
    } else {
      setNotice('Event created.');
      setTitle('');
      setDescription('');
      setActiveEventId(result.data.event.id);
      await refreshEvents();
    }
    setCreating(false);
  }, [title, description, setError, setNotice, setActiveEventId, refreshEvents]);

  const deleteDraft = useCallback(async (eventId: string) => {
    setDeletingId(eventId);
    setError(null);
    setNotice(null);
    const result = await adminMutate(`/api/beacon/${eventId}`, 'DELETE');
    if (!result.ok) {
      setError(result.message ?? 'Could not delete the draft.');
    } else {
      setNotice('Draft deleted.');
      setActiveEventId((current) => (current === eventId ? null : current));
      await refreshEvents();
    }
    setConfirmDeleteId(null);
    setDeletingId(null);
  }, [setError, setNotice, setActiveEventId, refreshEvents]);

  const goLive = useCallback(async (eventId: string) => {
    setError(null);
    setNotice(null);
    let data: BeaconIngest;
    try {
      data = await loadBeaconIngest(eventId);
    } catch (ingestError) {
      setError(ingestError instanceof Error ? ingestError.message : 'Broadcast input is unavailable.');
      return;
    }
    setIngest(data);
    const result = await adminMutate(`/api/beacon/${eventId}/go-live`, 'POST');
    if (!result.ok) {
      setError(result.message ?? 'Could not start the broadcast.');
      return;
    }
    setNotice('You are live. A "live now" notice was posted to the Commons.');
    setHost(data);
    // The admin's own chat view, the moderator seat. Chat is additive; the broadcast works without it.
    const credentials = await getBeaconChatCredentials(eventId).catch((chatError: unknown) => {
      reportError(chatError, { area: 'beacon', op: 'admin_chat_token', extra: { eventId } });
      return null;
    });
    if (credentials) setChat(credentials);
    await refreshEvents();
  }, [setError, setNotice, setIngest, setHost, setChat, refreshEvents]);

  const endEvent = useCallback(async (eventId: string) => {
    setError(null);
    const result = await adminMutate(`/api/beacon/${eventId}/end`, 'POST');
    if (!result.ok) {
      setError(result.message ?? 'Could not end the broadcast.');
      return;
    }
    setNotice('Broadcast ended. The replay posts to the Commons when the recording is ready.');
    setHost(null);
    setChat(null);
    setIngest(null);
    await refreshEvents();
  }, [setError, setNotice, setHost, setChat, setIngest, refreshEvents]);

  const moderate = useCallback(async (eventId: string, action: BeaconModerationAction, extra?: { targetUserId?: string; cooldownSeconds?: number }) => {
    setError(null);
    const result = await adminMutate(`/api/beacon/${eventId}/moderate`, 'POST', { action, ...extra });
    if (!result.ok) {
      setError(result.message ?? 'Could not apply moderation.');
      return;
    }
    setNotice(action === 'slow_mode' ? 'Slow-mode updated.' : `Member ${action === 'mute' ? 'muted' : 'banned'}.`);
  }, [setError, setNotice]);

  // Copies the value without ever logging it: a failure is reported by the copy step's name only.
  const copy = useCallback((label: string, value: string) => {
    Clipboard.setStringAsync(value)
      .then(() => {
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {
        reportError(new Error('The clipboard refused the copy.'), { area: 'beacon', op: 'admin_copy', extra: { label } });
      });
  }, []);

  return {
    title, setTitle, description, setDescription, creating, copied,
    moderateTarget, setModerateTarget, confirmDeleteId, setConfirmDeleteId, deletingId,
    createEvent, deleteDraft, goLive, endEvent, moderate, copy,
  };
}
