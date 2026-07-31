'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { Radio } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { WeaversBadge } from '@/components/contributor-access/weavers-badge';
import { getChymeTokens, type CurrentUser, requestJson } from './chyme-shared';
import { ChymeHeader } from './chyme-header';
import { ChymeSidebar } from './chyme-sidebar';
import { ChymeRoomView } from './chyme-room-view';
import type {
  ChymeJoinResponse,
  ChymeMessage,
  ChymeRoomResponse,
} from 'lib/chyme/types';

export type ChymeRoomScope = 'main' | 'contributors';

type ChymeTokens = ReturnType<typeof getChymeTokens>;

// Everything ChymeLiveShell needs from the shell controller: the room/chat state, the derived
// `locked` and `t` values, and the async handlers. Hoisted into a hook so the component itself stays
// a thin render — the hooks below run in exactly the order they always have (state, ref, theme, then
// the three effects), so hook ordering is unchanged.
function useChymeShellState(roomScope: ChymeRoomScope) {
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
  // Only the private contributors room can be "locked": a member who is not eligible (or the channel
  // is not open yet) gets a 404 from the room read, and we show the "how it's earned" explainer
  // instead — the same no-shaming pattern the gated Commons chat uses.
  const [locked, setLocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const t = getChymeTokens(theme);

  // Append the room scope to a Chyme API path so every read/write acts on the right room. The main
  // room adds nothing; the private room adds `room=contributors`.
  const withRoom = (path: string): string => {
    if (roomScope !== 'contributors') return path;
    return path.includes('?') ? `${path}&room=contributors` : `${path}?room=contributors`;
  };

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      setLocked(false);
      try {
        // Read the room with explicit status handling so a private-room 404 (not eligible / channel
        // closed) becomes the locked explainer rather than a generic error.
        const roomRes = await fetch(withRoom('/api/chyme/room'), { cache: 'no-store' });
        if (roomScope === 'contributors' && roomRes.status === 404) {
          if (active) {
            setLocked(true);
            setLoading(false);
          }
          return;
        }
        if (!roomRes.ok) {
          throw new Error('Unable to load Chyme.');
        }
        const roomPayload = (await roomRes.json()) as ChymeRoomResponse;
        const messagePayload = await requestJson<{ roomKey: string; messages: ChymeMessage[] }>(
          withRoom('/api/chyme/messages?limit=50'),
        );
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
  }, [roomScope]);

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
      void requestJson<ChymeRoomResponse>(withRoom('/api/chyme/room'))
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
        requestJson<ChymeRoomResponse>(withRoom('/api/chyme/room')),
        requestJson<{ roomKey: string; messages: ChymeMessage[] }>(withRoom('/api/chyme/messages?limit=50')),
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
      const payload = await requestJson<{ ok: true; message: ChymeMessage }>(withRoom('/api/chyme/messages'), {
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

  // Delete one of the member's own chat messages. Optimistically removes it, then DELETEs; on failure
  // it is restored and an error is shown. Author-only is enforced server-side.
  async function handleDeleteMessage(messageId: string): Promise<void> {
    let removed: ChymeMessage | undefined;
    setMessages((current) => {
      removed = current.find((m) => m.id === messageId);
      return current.filter((m) => m.id !== messageId);
    });
    try {
      await requestJson(withRoom(`/api/chyme/messages/${encodeURIComponent(messageId)}`), { method: 'DELETE' });
    } catch (deleteError) {
      if (removed) {
        const restored = removed;
        setMessages((current) => [...current, restored].sort((a, b) => a.sentAtIso.localeCompare(b.sentAtIso)));
      }
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete your message.');
    }
  }

  // Edit = delete + repost (matching the Commons home chat): load the message text back into the
  // composer and delete the original, so the member fixes it and sends a fresh message.
  function handleEditMessage(messageId: string, text: string): void {
    setDraft(text);
    void handleDeleteMessage(messageId);
  }

  async function handleLeave(): Promise<void> {
    // Unmount the Stream client immediately, then drop server-side presence so the member
    // stops being counted right away, and refresh the room so the count reflects the leave.
    setJoinState('idle');
    setJoinInfo(null);
    try {
      await requestJson(withRoom('/api/chyme/leave'), { method: 'POST' });
    } catch {
      // Best-effort: the presence window will lapse the member anyway.
    }
    try {
      const refreshedRoom = await requestJson<ChymeRoomResponse>(withRoom('/api/chyme/room'));
      setRoom(refreshedRoom);
    } catch {
      // Ignore a transient refresh failure.
    }
  }

  async function handleJoin(): Promise<void> {
    setJoinState('joining');
    setError(null);
    try {
      const payload = await requestJson<ChymeJoinResponse>(withRoom('/api/chyme/join'), { method: 'POST' });
      setJoinInfo(payload);
      setJoinState('ready');
      const refreshedRoom = await requestJson<ChymeRoomResponse>(withRoom('/api/chyme/room'));
      setRoom(refreshedRoom);
    } catch (joinError) {
      setJoinState('idle');
      setError(joinError instanceof Error ? joinError.message : 'Unable to join Chyme call.');
    }
  }

  return {
    room,
    messages,
    draft,
    loading,
    sending,
    joinState,
    joinInfo,
    error,
    showChat,
    refreshing,
    locked,
    messagesEndRef,
    t,
    setDraft,
    setShowChat,
    refreshRoomAndMessages,
    handleSend,
    handleEditMessage,
    handleDeleteMessage,
    handleLeave,
    handleJoin,
  };
}

// Private room, member not eligible (or the channel isn't open yet). No-shaming: show the same
// "how it's earned" explainer the gated Commons chat uses, never a locked/absence state elsewhere.
function ChymeLockedExplainer({ t }: { t: ChymeTokens }) {
  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%', background: t.BG, color: t.TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <WeaversBadge size={40} />
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE }}>Weavers of the Commons</div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: t.FAINT }}>
          This is a private audio room for consistent, broad contributors to the community — real
          help, delivered over time. Anyone can earn it; when you do, the room opens here.
        </div>
        <Link
          href="/apps/directory/weavers-of-the-commons"
          style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: t.ACCENT, textDecoration: 'none' }}
        >
          How it&rsquo;s earned →
        </Link>
      </div>
    </div>
  );
}

function ChymeErrorBanner({ error }: { error: string }) {
  return (
    <div style={{ padding: '12px 24px', background: '#2b0b0b', border: `1px solid #7f1d1d`, color: '#fecaca', fontSize: 13, margin: 16, borderRadius: 12 }}>
      {error}
    </div>
  );
}

// Shown when no room is active yet: the "Join a Room" call to action.
function ChymeJoinRoomPrompt({ t }: { t: ChymeTokens }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: `${t.ACCENT}18`, border: `2px solid ${t.ACCENT}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Radio size={36} style={{ color: t.ACCENT }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.TITLE }}>Join a Room</div>
      <div style={{ fontSize: 15, color: t.FAINT, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
        Select a live room to listen, speak, and connect with survivors worldwide. All rooms are members-only.
      </div>
    </div>
  );
}

type ChymeShellContentProps = {
  error: string | null;
  room: ChymeRoomResponse | null;
  loading: boolean;
  t: ChymeTokens;
  currentUser: CurrentUser;
  showChat: boolean;
  onToggleChat: () => void;
  joinInfo: ChymeJoinResponse | null;
  joinReady: boolean;
  messages: ChymeMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onLeave: () => void;
  roomScope: ChymeRoomScope;
  onEditMessage: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
};

// The main content column: error banner, the empty "Join a Room" prompt, or the live room view.
function ChymeShellContent(props: ChymeShellContentProps) {
  const { error, room, loading, t } = props;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {error && <ChymeErrorBanner error={error} />}

      {!room && !loading && <ChymeJoinRoomPrompt t={t} />}

      {room && (
        <ChymeRoomView
          room={room}
          currentUser={props.currentUser}
          showChat={props.showChat}
          onToggleChat={props.onToggleChat}
          joinInfo={props.joinInfo}
          joinReady={props.joinReady}
          messages={props.messages}
          draft={props.draft}
          onDraftChange={props.onDraftChange}
          onSend={props.onSend}
          sending={props.sending}
          messagesEndRef={props.messagesEndRef}
          onLeave={props.onLeave}
          roomScope={props.roomScope}
          onEditMessage={props.onEditMessage}
          onDeleteMessage={props.onDeleteMessage}
        />
      )}
    </div>
  );
}

export function ChymeLiveShell({ currentUser, roomScope = 'main' }: { currentUser: CurrentUser; roomScope?: ChymeRoomScope }) {
  const {
    room,
    messages,
    draft,
    loading,
    sending,
    joinState,
    joinInfo,
    error,
    showChat,
    refreshing,
    locked,
    messagesEndRef,
    t,
    setDraft,
    setShowChat,
    refreshRoomAndMessages,
    handleSend,
    handleEditMessage,
    handleDeleteMessage,
    handleLeave,
    handleJoin,
  } = useChymeShellState(roomScope);

  if (locked) {
    return <ChymeLockedExplainer t={t} />;
  }

  return (
    <div style={{ minHeight: '100dvh', width: '100%', background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <ChymeHeader
        participantCount={room?.participants.length ?? 0}
        isLive={Boolean(room)}
        onRefresh={() => void refreshRoomAndMessages()}
        refreshing={refreshing}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ChymeSidebar
          loading={loading}
          joinState={joinState}
          onJoin={() => void handleJoin()}
          onRefresh={() => void refreshRoomAndMessages()}
          refreshing={refreshing}
        />

        <ChymeShellContent
          error={error}
          room={room}
          loading={loading}
          t={t}
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
          roomScope={roomScope}
          onEditMessage={handleEditMessage}
          onDeleteMessage={(id) => void handleDeleteMessage(id)}
        />
      </div>
    </div>
  );
}
