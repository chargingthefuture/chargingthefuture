'use client';

import { useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { DARK_BG, PRIMARY, type CurrentUser, requestJson } from './chyme-shared';
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
  const [muted, setMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  async function refreshMessages(): Promise<void> {
    const payload = await requestJson<{ roomKey: string; messages: ChymeMessage[] }>('/api/chyme/messages?limit=50');
    setMessages(payload.messages);
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
    <div style={{ minHeight: '100vh', width: '100%', background: DARK_BG, fontFamily: "'Inter', system-ui, sans-serif", color: '#E8EAF0', display: 'flex', flexDirection: 'column' }}>
      <ChymeHeader
        participantCount={room?.participants.length ?? 0}
        isLive={Boolean(room)}
        onRefresh={() => void refreshMessages()}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ChymeSidebar
          loading={loading}
          room={room}
          joinState={joinState}
          onJoin={() => void handleJoin()}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {error && (
            <div style={{ padding: '12px 24px', background: '#2b0b0b', border: `1px solid #7f1d1d`, color: '#fecaca', fontSize: 13, margin: 16, borderRadius: 12 }}>
              {error}
            </div>
          )}

          {!room && !loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: `${PRIMARY}18`, border: `2px solid ${PRIMARY}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Radio size={36} style={{ color: PRIMARY }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#F0FDF4' }}>Join a Room</div>
              <div style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                Select a live room to listen, speak, and connect with survivors worldwide. All rooms are safe spaces.
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
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              handRaised={handRaised}
              onToggleHand={() => setHandRaised((h) => !h)}
              onLeave={() => { setJoinState('idle'); setJoinInfo(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
