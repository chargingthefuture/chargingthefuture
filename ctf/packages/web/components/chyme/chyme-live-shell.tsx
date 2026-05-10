'use client';

import { useEffect, useRef, useState } from 'react';
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
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : 'Request failed.';
    throw new Error(message);
  }
  return payload as T;
}

const PRIMARY = '#22C55E';
const DARK_BG = '#021006';
const CARD_BG = '#041a0b';
const BORDER = '#052e16';

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
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

  async function handleServiceDelete(): Promise<void> {
    setError(null);
    try {
      const payload = await requestJson<ChymeDeletionResponse>('/api/account/chyme-profile', { method: 'DELETE' });
      setDeletionState(payload);
      setRoom((current) =>
        current
          ? { ...current, participants: current.participants.filter((p) => p.userId !== currentUser.userId) }
          : current
      );
      setMessages((current) => current.filter((m) => m.userId !== currentUser.userId));
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
    <div style={{ minHeight: '100vh', width: '100%', background: DARK_BG, fontFamily: "'Inter', system-ui, sans-serif", color: '#E8EAF0', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{ height: 60, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#030d05', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${PRIMARY}25`, border: `1px solid ${PRIMARY}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            🎙️
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#F0FDF4' }}>Chyme 🎙️</div>
            <div style={{ fontSize: 12, color: '#16A34A' }}>Social Audio · GetStream Powered</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {room && (
          <span style={{ background: `${PRIMARY}15`, color: PRIMARY, border: `1px solid ${PRIMARY}30`, fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
            🔴 Live
          </span>
        )}
        <span style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
          {room?.participants.length ?? 0} Participants
        </span>
        <button
          onClick={() => void refreshMessages()}
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', fontSize: 16 }}
        >
          🔄
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{ width: 300, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#030d05' }}>
          <div style={{ padding: '16px 16px 12px' }}>
            <button
              onClick={() => void handleJoin()}
              disabled={joinState === 'joining' || joinState === 'ready'}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, #16A34A 100%)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: joinState === 'idle' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: joinState !== 'idle' ? 0.7 : 1 }}
            >
              <span>🎤</span>
              {joinState === 'joining' ? 'Joining…' : joinState === 'ready' ? '✓ Joined' : 'Join Room'}
            </button>
          </div>

          {/* Room info */}
          {loading ? (
            <div style={{ padding: '12px 16px', color: '#16A34A', fontSize: 13 }}>Loading room…</div>
          ) : room ? (
            <div style={{ padding: '12px', margin: '0 12px 12px', borderRadius: 12, background: `${PRIMARY}14`, border: `1px solid ${PRIMARY}40`, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIMARY, flexShrink: 0, marginTop: 6, boxShadow: `0 0 6px ${PRIMARY}` }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0FDF4', lineHeight: 1.4, flex: 1 }}>{room.roomName}</div>
              </div>
              <div style={{ fontSize: 12, color: '#16A34A', marginBottom: 6 }}>
                Key: {room.roomKey} · {room.participants.length} participants
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: PRIMARY, background: `${PRIMARY}15`, padding: '2px 8px', borderRadius: 20, border: `1px solid ${PRIMARY}25` }}>
                  #{room.callActive ? 'live' : 'idle'}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: '#4B5563', fontSize: 12 }}>
                  👥 {room.participants.length}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 16px', color: '#4B5563', fontSize: 13 }}>No active room</div>
          )}

          {/* Deletion actions */}
          <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => void handleServiceDelete()}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#fecaca', fontSize: 12, cursor: 'pointer' }}
            >
              Delete Chyme Data
            </button>
            <button
              onClick={() => void handleFullDelete()}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: 12, cursor: 'pointer' }}
            >
              Delete Full Account
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {error && (
            <div style={{ padding: '12px 24px', background: '#2b0b0b', border: `1px solid #7f1d1d`, color: '#fecaca', fontSize: 13, margin: 16, borderRadius: 12 }}>
              {error}
            </div>
          )}

          {!room && !loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: `${PRIMARY}18`, border: `2px solid ${PRIMARY}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                🎙️
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#F0FDF4' }}>Join a Room</div>
              <div style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                Select a live room to listen, speak, and connect with survivors worldwide. All rooms are safe spaces.
              </div>
            </div>
          )}

          {room && (
            <>
              {/* Room header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIMARY, boxShadow: `0 0 8px ${PRIMARY}` }} />
                      <span style={{ background: `${PRIMARY}15`, color: PRIMARY, border: `1px solid ${PRIMARY}30`, fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>
                        {room.callActive ? '🔴 Live' : 'Idle'}
                      </span>
                      <span style={{ fontSize: 12, color: '#4B5563' }}>Safe Space Room</span>
                      <span style={{ fontSize: 12, color: '#4B5563' }}>🔒</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#F0FDF4', lineHeight: 1.3, marginBottom: 4 }}>{room.roomName}</div>
                    <div style={{ fontSize: 13, color: '#16A34A' }}>{room.participants.length} participants · Signed in as {currentUser.displayName}</div>
                  </div>
                  <button
                    onClick={() => setShowChat(!showChat)}
                    style={{ padding: '8px 14px', borderRadius: 10, background: showChat ? `${PRIMARY}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${showChat ? PRIMARY + '40' : 'rgba(255,255,255,0.08)'}`, color: showChat ? PRIMARY : '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    💬 Chat
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Stage */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  {/* Stream video panel after join */}
                  {joinInfo && joinState === 'ready' && (
                    <div style={{ marginBottom: 24, padding: 16, borderRadius: 14, background: CARD_BG, border: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F0FDF4', marginBottom: 12 }}>Audio Room</div>
                      <StreamVideoPanel
                        streamApiKey={joinInfo.streamApiKey}
                        streamToken={joinInfo.streamToken}
                        streamUserId={joinInfo.streamUserId}
                        streamChannelId={joinInfo.streamChannelId}
                      />
                    </div>
                  )}

                  {/* Participants on stage */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 16 }}>
                      On Stage · {room.participants.length} Participants
                    </div>
                    {room.participants.length === 0 ? (
                      <div style={{ color: '#4B5563', fontSize: 14 }}>No participants yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                        {room.participants.map((participant) => (
                          <div key={participant.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 100 }}>
                            <div style={{ position: 'relative' }}>
                              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${PRIMARY}20`, border: `3px solid ${participant.userId === currentUser.userId ? PRIMARY : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: participant.userId === currentUser.userId ? `0 0 20px ${PRIMARY}50` : 'none' }}>
                                <span style={{ fontSize: 20, fontWeight: 800, color: PRIMARY }}>{initials(participant.displayName)}</span>
                              </div>
                              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: PRIMARY, border: '2px solid #021006', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                                🎤
                              </div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EAF0', textAlign: 'center' }}>{participant.displayName}</div>
                            <span style={{ fontSize: 10, background: participant.role === 'speaker' ? `${PRIMARY}20` : 'rgba(255,255,255,0.05)', color: participant.role === 'speaker' ? PRIMARY : '#6B7280', border: `1px solid ${participant.role === 'speaker' ? PRIMARY + '35' : 'transparent'}`, padding: '1px 8px', borderRadius: 20 }}>
                              {participant.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deletion status */}
                  {deletionState && (
                    <div style={{ padding: '12px 16px', borderRadius: 12, background: CARD_BG, border: `1px solid ${BORDER}`, fontSize: 13, color: '#A7F3D0' }}>
                      Deletion: {deletionState.scope} / {deletionState.status} at {deletionState.requestedAtIso}
                    </div>
                  )}
                </div>

                {/* Chat panel */}
                {showChat && (
                  <div style={{ width: 300, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', background: '#030d05', flexShrink: 0 }}>
                    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: PRIMARY }}>#</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#F0FDF4' }}>Room Chat</span>
                      <span style={{ marginLeft: 'auto', background: `${PRIMARY}15`, color: PRIMARY, border: `1px solid ${PRIMARY}25`, fontSize: 10, padding: '2px 8px', borderRadius: 12 }}>GetStream</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
                      {messages.length === 0 ? (
                        <div style={{ color: '#4B5563', fontSize: 13 }}>No messages yet.</div>
                      ) : (
                        messages.map((message) => (
                          <div key={message.id} style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: message.userId === currentUser.userId ? PRIMARY : '#A7F3D0' }}>{message.displayName}</span>
                              <span style={{ fontSize: 11, color: '#374151' }}>{new Date(message.sentAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5 }}>{message.text}</div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}` }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px' }}>
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
                          placeholder="Send a message…"
                          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#E8EAF0' }}
                        />
                        <button
                          onClick={() => void handleSend()}
                          disabled={sending || !draft.trim()}
                          style={{ width: 28, height: 28, borderRadius: 6, background: draft.trim() ? PRIMARY : 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: draft.trim() ? 'pointer' : 'not-allowed', fontSize: 14 }}
                        >
                          <span style={{ color: draft.trim() ? '#fff' : '#4B5563' }}>➤</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Room controls */}
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}`, background: '#030d05', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <button
                  onClick={() => setMuted(!muted)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: muted ? 'rgba(239,68,68,0.15)' : `${PRIMARY}18`, border: `1px solid ${muted ? 'rgba(239,68,68,0.4)' : PRIMARY + '40'}`, color: muted ? '#F87171' : PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {muted ? '🔇 Unmute' : '🎤 Mute'}
                </button>
                <button
                  onClick={() => setHandRaised(!handRaised)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: handRaised ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${handRaised ? 'rgba(234,179,8,0.4)' : 'rgba(255,255,255,0.08)'}`, color: handRaised ? '#FDE047' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  ✋ {handRaised ? 'Lower Hand' : 'Raise Hand'}
                </button>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 12, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔊 Audio via GetStream
                </div>
                {joinState === 'ready' && (
                  <button
                    onClick={() => { setJoinState('idle'); setJoinInfo(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    📞 Leave
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
