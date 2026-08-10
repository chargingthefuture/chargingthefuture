'use client';

import { useCallback, useState } from 'react';
import type { CommonsAnnouncementReply, CommonsAnnouncementRepliesResponse } from '../../lib/commons/types';

// The reply thread's state and network calls for one announcement card: opening the thread, loading
// it on demand, posting a reply, and — for the member's own replies — rewriting or removing one.
// Kept out of the card so the card stays a rendering file (rule 116) and every request here carries
// the CSRF header exactly once.

const CSRF_HEADERS = { 'content-type': 'application/json', 'x-ctf-csrf': '1' } as const;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }
  return payload as T;
}

// What the route said about the failure, or the screen's own sentence when it said nothing. The
// routes here explain themselves ("You can only change your own replies."), so showing their words
// beats replacing them with a generic line.
function messageOf(error: unknown, fallback: string): string {
  const said = error instanceof Error ? error.message.trim() : '';
  return said.length > 0 ? said : fallback;
}

export type AnnouncementRepliesState = {
  threadOpen: boolean;
  loading: boolean;
  loaded: boolean;
  replies: CommonsAnnouncementReply[];
  error: string | null;
  replyInput: string;
  sending: boolean;
  localCount: number;
  // The reply currently being rewritten, and the text in its editor. Null when nothing is being
  // edited — only one reply is editable at a time, so a half-finished edit cannot be lost by
  // opening a second one.
  editingId: string | null;
  editInput: string;
  busyReplyId: string | null;
  setReplyInput: (value: string) => void;
  setEditInput: (value: string) => void;
  toggleThread: () => void;
  sendReply: () => void;
  startEdit: (reply: CommonsAnnouncementReply) => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  deleteReply: (reply: CommonsAnnouncementReply) => void;
};

export function useAnnouncementReplies(
  announcementId: string | null | undefined,
  initialCount: number,
): AnnouncementRepliesState {
  const [threadOpen, setThreadOpen] = useState(false);
  const [replies, setReplies] = useState<CommonsAnnouncementReply[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [sending, setSending] = useState(false);
  const [localCount, setLocalCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const [busyReplyId, setBusyReplyId] = useState<string | null>(null);

  const loadReplies = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestJson<CommonsAnnouncementRepliesResponse>(
        `/api/announcements/${encodeURIComponent(id)}/replies`,
      );
      setReplies(payload.replies);
      setLocalCount(payload.replies.length);
      setLoaded(true);
    } catch (loadError) {
      setError(messageOf(loadError, 'Unable to load replies right now.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleThread = useCallback(() => {
    if (!announcementId) return;
    const next = !threadOpen;
    setThreadOpen(next);
    // Load the thread the first time it is opened; later opens reuse what we have.
    if (next && !loaded && !loading) {
      void loadReplies(announcementId);
    }
  }, [announcementId, threadOpen, loaded, loading, loadReplies]);

  const sendReply = useCallback(async () => {
    if (!announcementId) return;
    const text = replyInput.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      const payload = await requestJson<{ ok: true; reply: CommonsAnnouncementReply }>(
        `/api/announcements/${encodeURIComponent(announcementId)}/replies`,
        { method: 'POST', headers: CSRF_HEADERS, body: JSON.stringify({ body: text }) },
      );
      setReplies((previous) => [...previous, payload.reply]);
      setLocalCount((previous) => previous + 1);
      setLoaded(true);
      setReplyInput('');
    } catch (sendError) {
      setError(messageOf(sendError, 'Unable to post your reply right now.'));
    } finally {
      setSending(false);
    }
  }, [announcementId, replyInput, sending]);

  const startEdit = useCallback((reply: CommonsAnnouncementReply) => {
    setEditingId(reply.id);
    setEditInput(reply.body);
    setError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditInput('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!announcementId || !editingId) return;
    const text = editInput.trim();
    if (!text || busyReplyId) return;

    setBusyReplyId(editingId);
    setError(null);
    try {
      const payload = await requestJson<{ ok: true; replyId: string; body: string; editedAtIso: string }>(
        `/api/announcements/${encodeURIComponent(announcementId)}/replies/${encodeURIComponent(editingId)}`,
        { method: 'PATCH', headers: CSRF_HEADERS, body: JSON.stringify({ body: text }) },
      );
      setReplies((previous) =>
        previous.map((reply) =>
          reply.id === payload.replyId
            ? { ...reply, body: payload.body, editedAtIso: payload.editedAtIso }
            : reply,
        ),
      );
      setEditingId(null);
      setEditInput('');
    } catch (editError) {
      setError(messageOf(editError, 'Unable to save your change right now.'));
    } finally {
      setBusyReplyId(null);
    }
  }, [announcementId, editingId, editInput, busyReplyId]);

  const deleteReply = useCallback(async (reply: CommonsAnnouncementReply) => {
    if (!announcementId || busyReplyId) return;
    // Deleting a reply is not reversible for the member, so it asks first.
    if (!window.confirm('Delete this reply? It will be removed for everyone.')) return;

    setBusyReplyId(reply.id);
    setError(null);
    try {
      await requestJson<{ ok: true }>(
        `/api/announcements/${encodeURIComponent(announcementId)}/replies/${encodeURIComponent(reply.id)}`,
        { method: 'DELETE', headers: CSRF_HEADERS },
      );
      setReplies((previous) => previous.filter((item) => item.id !== reply.id));
      setLocalCount((previous) => Math.max(previous - 1, 0));
      if (editingId === reply.id) {
        setEditingId(null);
        setEditInput('');
      }
    } catch (deleteError) {
      setError(messageOf(deleteError, 'Unable to delete your reply right now.'));
    } finally {
      setBusyReplyId(null);
    }
  }, [announcementId, busyReplyId, editingId]);

  return {
    threadOpen,
    loading,
    loaded,
    replies,
    error,
    replyInput,
    sending,
    localCount,
    editingId,
    editInput,
    busyReplyId,
    setReplyInput,
    setEditInput,
    toggleThread,
    sendReply: () => void sendReply(),
    startEdit,
    cancelEdit,
    saveEdit: () => void saveEdit(),
    deleteReply: (reply: CommonsAnnouncementReply) => void deleteReply(reply),
  };
}
