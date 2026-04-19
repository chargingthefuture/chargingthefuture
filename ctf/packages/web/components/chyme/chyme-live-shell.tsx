'use client';

import { useEffect, useState } from 'react';
import { StreamVideoPanel } from '../shared/stream-video-panel';
import type {
  ChymeDeletionResponse,
  ChymeJoinResponse,
  ChymeMessage,
  ChymeRoomResponse,
} from 'lib/chyme/types';

type CurrentUser = {
  userId: string;
  username: string | null;
  displayName: string;
};

type RequestError = {
  message: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | RequestError | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? payload.message
      : 'Request failed.';
    throw new Error(message);
  }

  return payload as T;
}

export function ChymeLiveShell({ currentUser }: { currentUser: CurrentUser }) {
  const [room, setRoom] = useState<ChymeRoomResponse | null>(null);
  const [messages, setMessages] = useState<ChymeMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'ready'>('idle');
  const [joinInfo, setJoinInfo] = useState<ChymeJoinResponse | null>(null);
  const [deletionState, setDeletionState] = useState<ChymeDeletionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [roomPayload, messagePayload] = await Promise.all([
          requestJson<ChymeRoomResponse>('/api/chyme/room'),
          requestJson<{ roomKey: string; messages: ChymeMessage[] }>('/api/chyme/messages?limit=50'),
        ]);

        if (!active) {
          return;
        }

        setRoom(roomPayload);
        setMessages(messagePayload.messages);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Chyme.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function refreshMessages(): Promise<void> {
    const payload = await requestJson<{ roomKey: string; messages: ChymeMessage[] }>('/api/chyme/messages?limit=50');
    setMessages(payload.messages);
  }

  async function handleSend(): Promise<void> {
    const text = draft.trim();
    if (!text || sending) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const payload = await requestJson<{ ok: true; message: ChymeMessage }>('/api/chyme/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setMessages((current) => [...current, payload.message]);
      setDraft('');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }

  async function handleJoin(): Promise<void> {
    setJoinState('joining');
    setError(null);

    try {
      const payload = await requestJson<ChymeJoinResponse>('/api/chyme/join', { method: 'POST' });
      setJoinInfo(payload);
      setJoinState('ready');
      const refreshedRoom = await requestJson<ChymeRoomResponse>('/api/chyme/room');
      setRoom(refreshedRoom);
    } catch (joinError) {
      setJoinState('idle');
      setError(joinError instanceof Error ? joinError.message : 'Unable to join Chyme call.');
    }
  }

  async function handleServiceDelete(): Promise<void> {
    setError(null);
    try {
      const payload = await requestJson<ChymeDeletionResponse>('/api/account/chyme-profile', { method: 'DELETE' });
      setDeletionState(payload);
      setRoom((current) => current
        ? { ...current, participants: current.participants.filter((participant) => participant.userId !== currentUser.userId) }
        : current);
      setMessages((current) => current.filter((message) => message.userId !== currentUser.userId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete Chyme data.');
    }
  }

  async function handleFullDelete(): Promise<void> {
    setError(null);
    try {
      const payload = await requestJson<ChymeDeletionResponse>('/api/account/full-account', { method: 'DELETE' });
      setDeletionState(payload);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to request full account deletion.');
    }
  }

  return (
    <div className="min-h-screen bg-[#021006] text-[#E8EAF0]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row">
        <section className="flex-1 rounded-3xl border border-[#052e16] bg-[#030d05] p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#16A34A]">Chyme</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#F0FDF4]">Social audio room</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#A7F3D0]">
                Real room bootstrap, companion chat, Stream-backed join credentials, and deletion flows.
              </p>
            </div>

            <div className="rounded-2xl border border-[#14532d] bg-[#041a0b] px-4 py-3 text-sm">
              <div className="font-medium text-[#F0FDF4]">Signed in as {currentUser.displayName}</div>
              <div className="mt-1 text-[#86efac]">{currentUser.userId}</div>
            </div>
          </div>

          {loading ? <p className="text-sm text-[#86efac]">Loading room state...</p> : null}
          {error ? <p className="mb-4 rounded-xl border border-[#7f1d1d] bg-[#2b0b0b] px-4 py-3 text-sm text-[#fecaca]">{error}</p> : null}

          {room ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#14532d] bg-[#041a0b] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[#16A34A]">Room</div>
                  <div className="mt-2 text-xl font-semibold text-[#F0FDF4]">{room.roomName}</div>
                  <div className="mt-2 text-sm text-[#86efac]">Key: {room.roomKey}</div>
                </div>

                <div className="rounded-2xl border border-[#14532d] bg-[#041a0b] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[#16A34A]">Call state</div>
                  <div className="mt-2 text-xl font-semibold text-[#F0FDF4]">{room.callActive ? 'Active' : 'Idle'}</div>
                  <div className="mt-2 text-sm text-[#86efac]">Stream join: {joinState === 'ready' ? 'ready' : joinState}</div>
                </div>

                <div className="rounded-2xl border border-[#14532d] bg-[#041a0b] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[#16A34A]">Participants</div>
                  <div className="mt-2 text-xl font-semibold text-[#F0FDF4]">{room.participants.length}</div>
                  <div className="mt-2 text-sm text-[#86efac]">Approved-user-or-admin gate enforced</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={joinState === 'joining'}
                  onClick={() => void handleJoin()}
                >
                  {joinState === 'joining' ? 'Joining…' : 'Join Call'}
                </button>
                <button
                  className="rounded-xl border border-[#14532d] bg-[#041a0b] px-4 py-2 text-sm font-semibold text-[#F0FDF4]"
                  onClick={() => void refreshMessages()}
                >
                  Refresh Chat
                </button>
                <button
                  className="rounded-xl border border-[#7f1d1d] bg-[#2b0b0b] px-4 py-2 text-sm font-semibold text-[#fecaca]"
                  onClick={() => void handleServiceDelete()}
                >
                  Delete Chyme Data
                </button>
                <button
                  className="rounded-xl border border-[#7f1d1d] bg-transparent px-4 py-2 text-sm font-semibold text-[#fecaca]"
                  onClick={() => void handleFullDelete()}
                >
                  Delete Full Account
                </button>
              </div>

              {joinInfo ? (
                <div className="mt-4 rounded-2xl border border-[#14532d] bg-[#041a0b] p-4 text-sm text-[#A7F3D0]">
                  <h3 className="mb-2 font-semibold text-[#F0FDF4]">Audio Room</h3>
                  <StreamVideoPanel
                    streamApiKey={joinInfo.streamApiKey}
                    streamToken={joinInfo.streamToken}
                    streamUserId={joinInfo.streamUserId}
                    streamChannelId={joinInfo.streamChannelId}
                  />
                </div>
              ) : null}

              {deletionState ? (
                <div className="mt-4 rounded-2xl border border-[#14532d] bg-[#041a0b] p-4 text-sm text-[#A7F3D0]">
                  Last deletion action: {deletionState.scope} / {deletionState.status} at {deletionState.requestedAtIso}
                </div>
              ) : null}

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-2xl border border-[#14532d] bg-[#041a0b] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#F0FDF4]">Companion chat</h2>
                    <span className="text-xs uppercase tracking-[0.16em] text-[#16A34A]">Server-backed</span>
                  </div>

                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                    {messages.map((message) => (
                      <article key={message.id} className="rounded-xl border border-[#14532d] bg-[#05210f] p-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-semibold text-[#F0FDF4]">{message.displayName}</div>
                          <div className="text-xs text-[#86efac]">{new Date(message.sentAtIso).toLocaleString()}</div>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#d1fae5]">{message.text}</p>
                      </article>
                    ))}
                    {messages.length === 0 ? <p className="text-sm text-[#86efac]">No messages yet.</p> : null}
                  </div>

                  <div className="mt-4 flex gap-3">
                    <input
                      className="flex-1 rounded-xl border border-[#14532d] bg-[#021006] px-4 py-3 text-sm text-[#F0FDF4] outline-none"
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void handleSend();
                        }
                      }}
                      placeholder="Share your thoughts"
                      value={draft}
                    />
                    <button
                      className="rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={sending || draft.trim().length === 0}
                      onClick={() => void handleSend()}
                    >
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#14532d] bg-[#041a0b] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#F0FDF4]">Participants</h2>
                    <span className="text-xs uppercase tracking-[0.16em] text-[#16A34A]">Deterministic room</span>
                  </div>

                  <div className="space-y-3">
                    {room.participants.map((participant) => (
                      <div key={participant.userId} className="rounded-xl border border-[#14532d] bg-[#05210f] p-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-[#F0FDF4]">{participant.displayName}</div>
                            <div className="text-xs text-[#86efac]">{participant.userId}</div>
                          </div>
                          <div className="rounded-full border border-[#166534] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[#bbf7d0]">
                            {participant.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}