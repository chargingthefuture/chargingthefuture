'use client';

import { useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, type CurrentUser, requestJson } from './chyme-shared';
import { ChymeHeader } from './chyme-header';
import { ChymeSidebar } from './chyme-sidebar';
import { ChymeRoomView } from './chyme-room-view';
import type {
  ChymeJoinResponse,
  ChymeMessage,
  ChymeRoomResponse,
} from 'lib/chyme/types';

export function ChymeLiveShell({ currentUser }: { currentUser: CurrentUser }) {
  const [room, setRoom] = useState<ChymeRoomResponse | null>(null);
  const [messages, setMessages] = useState<ChymeMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'ready'>('idle');
  const [joinInfo, setJoinInfo] = useState<ChymeJoinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const t = getChymeTokens(theme);

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
        if (!active) return;
        setRoom(roomPayload);
        setMessages(messagePayload.messages);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Chyme.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Light room poll: while a room is shown AND the tab is visible, refresh just the room state every
  // 15s so other members' persistent raised hands (and the live participant list) appear/disappear
  // without a manual refresh. It updates only `room` — chat messages and the draft are untouched.
  // A backgrounded tab stops polling, mirroring the heartbeat's visibility guard, so it stays light.
  const roomLoaded = room !== null;
  useEffect(() => {
    if (!roomLoaded) return;
    const poll = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void requestJson<ChymeRoomResponse>('/api/chyme/room')
        .then((payload) => setRoom(payload))
        .catch(() => {
          /* best-effort: a transient poll failure is ignored; the next tick retries */
        });
    };
    const intervalId = window.setInterval(poll, 15000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [roomLoaded]);

  // Refresh BOTH the room (live status + participant count) and the chat. The button used to refresh
  // only the messages, so when there were no new messages it looked like nothing happened and the
  // participant count never updated. `refreshing` drives the spinning icon so the press is visible.
  async function refreshRoomAndMessages(): Promise<void> {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const [roomPayload, messagePayload] = await Promise.all([
        requestJson<ChymeRoomResponse>('/api/chyme/room'),
        requestJson<{ roomKey: string; messages: ChymeMessage[] }>('/api/chyme/messages?limit=50'),
      ]);
      setRoom(roomPayload);
      setMessages(messagePayload.messages);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the room.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSend(): Promise<void> {
    const text = draft.trim();
    if (!text || sending) return;
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

  async function handleLeave(): Promise<void> {
    // Unmount the Stream client immediately, then drop server-side presence so the member
    // stops being counted right away, and refresh the room so the count reflects the leave.
    setJoinState('idle');
    setJoinInfo(null);
    try {
      await requestJson('/api/chyme/leave', { method: 'POST' });
    } catch {
      // Best-effort: the presence window will lapse the member anyway.
    }
    try {
      const refreshedRoom = await requestJson<ChymeRoomResponse>('/api/chyme/room');
      setRoom(refreshedRoom);
    } catch {
      // Ignore a transient refresh failure.
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

  return (
    <div style={{ minHeight: '100dvh', width: '100%', background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <ChymeHeader
        participantCount={room?.participants.length ?? 0}
        isLive={Boolean(room)}
        onRefresh={() => void refreshRoomAndMessages()}
        refreshing={refreshing}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
        <ChymeSidebar
          loading={loading}
          room={room}
          joinState={joinState}
          onJoin={() => void handleJoin()}
          onRefresh={() => void refreshRoomAndMessages()}
          refreshing={refreshing}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
          {error && (
            <div style={{ padding: '12px 24px', background: '#2b0b0b', border: `1px solid #7f1d1d`, color: '#fecaca', fontSize: 13, margin: 16, borderRadius: 12 }}>
              {error}
            </div>
          )}

          {!room && !loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: `${t.ACCENT}18`, border: `2px solid ${t.ACCENT}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Radio size={36} style={{ color: t.ACCENT }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.TITLE }}>Join a Room</div>
              <div style={{ fontSize: 15, color: t.FAINT, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                Select a live room to listen, speak, and connect with survivors worldwide. All rooms are members-only.
              </div>
            </div>
          )}

          {room && (
            <ChymeRoomView
              room={room}
              currentUser={currentUser}
              showChat={showChat}
              onToggleChat={() => setShowChat((s) => !s)}
              joinInfo={joinInfo}
              joinReady={joinState === 'ready'}
              messages={messages}
              draft={draft}
              onDraftChange={setDraft}
              onSend={() => void handleSend()}
              sending={sending}
              messagesEndRef={messagesEndRef}
              onLeave={() => void handleLeave()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
