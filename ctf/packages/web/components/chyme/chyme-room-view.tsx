'use client';

import { useMemo, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import { Lock, MessageSquare } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, chymeHandle, type CurrentUser } from './chyme-shared';
import { ChymeStage } from './chyme-stage';
import { ChymeChatPanel } from './chyme-chat-panel';
import type { ChymeJoinResponse, ChymeMessage, ChymeRoomResponse } from 'lib/chyme/types';
import type { ChymeConnectionState } from './chyme-audio-room';

// The live audio room pulls in the Stream Video SDK, which is browser-only, so
// it is loaded on the client and never server-rendered.
const ChymeAudioRoom = dynamic(() => import('./chyme-audio-room').then((m) => m.ChymeAudioRoom), {
  ssr: false,
});

export type ChymeRoomViewProps = {
  room: ChymeRoomResponse;
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
  roomScope: 'main' | 'contributors';
  onEditMessage: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onConnectionChange?: (state: ChymeConnectionState) => void;
};

// The member-facing quota line, under the room header. Only while the Stream quota policy has
// something to say (Yellow band and above); the meter's numbers stay on the admin screen.
function ChymeQuotaNotice({ notice, band }: { notice: string | null; band: ChymeRoomResponse['quota']['band'] }) {
  if (!notice) {
    return null;
  }
  const severe = band === 'red';
  return (
    <div
      role="status"
      style={{
        margin: '12px 24px 0',
        padding: '10px 14px',
        borderRadius: 10,
        fontSize: 13,
        lineHeight: 1.5,
        background: severe ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
        border: `1px solid ${severe ? 'rgba(239,68,68,0.35)' : 'rgba(234,179,8,0.35)'}`,
        color: severe ? '#FCA5A5' : '#FDE68A',
      }}
    >
      {notice}
    </div>
  );
}

export function ChymeRoomView(props: ChymeRoomViewProps) {
  const { room, currentUser, showChat, onToggleChat, joinInfo, joinReady } = props;
  const { theme } = useTheme();
  const t = getChymeTokens(theme);

  // Clerk user ids of members whose hand is raised, derived from the polled room state. Passed to
  // the audio room so each stage tile shows a persistent raised hand for everyone but the local
  // member (who is driven by their own instant toggle).
  const raisedHandUserIds = useMemo(
    () => new Set(room.participants.filter((p) => p.handRaised).map((p) => p.userId)),
    [room.participants],
  );

  const chatPanel = (
    <ChymeChatPanel
      messages={props.messages}
      currentUserId={currentUser.userId}
      draft={props.draft}
      onDraftChange={props.onDraftChange}
      onSend={props.onSend}
      sending={props.sending}
      messagesEndRef={props.messagesEndRef}
      onEditMessage={props.onEditMessage}
      onDeleteMessage={props.onDeleteMessage}
    />
  );

  const inCall = joinReady && joinInfo !== null;

  return (
    <>
      <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${t.BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.ACCENT, boxShadow: `0 0 8px ${t.ACCENT}` }} />
              <span style={{ background: `${t.ACCENT}15`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30`, fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>
                {room.callActive ? '🔴 Live' : 'Idle'}
              </span>
              <span style={{ fontSize: 12, color: t.FAINT }}>Members-Only Room</span>
              <Lock size={12} style={{ color: t.FAINT }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, lineHeight: 1.3, marginBottom: 4 }}>{room.roomName}</div>
            <div style={{ fontSize: 13, color: '#16A34A' }}>
              {room.participants.length} of {room.capacity.max} participants · Signed in as {chymeHandle(currentUser.username, currentUser.userId)}
            </div>
          </div>
          <button
            onClick={onToggleChat}
            style={{ padding: '8px 14px', borderRadius: 10, background: showChat ? `${t.ACCENT}20` : t.INPUT_BG, border: `1px solid ${showChat ? t.ACCENT + '40' : t.BORDER_STRONG}`, color: showChat ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MessageSquare size={14} /> Chat
          </button>
        </div>
      </div>

      <ChymeQuotaNotice notice={room.quota.notice} band={room.quota.band} />

      {inCall && joinInfo ? (
        <ChymeAudioRoom
          joinInfo={joinInfo}
          currentUser={currentUser}
          showChat={showChat}
          chatPanel={chatPanel}
          isMobile={true}
          onLeave={props.onLeave}
          raisedHandUserIds={raisedHandUserIds}
          roomScope={props.roomScope}
          backChannelAllowed={room.quota.backChannelAllowed}
          onConnectionChange={props.onConnectionChange}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ChymeStage room={room} currentUserId={currentUser.userId} />
          {showChat && chatPanel}
        </div>
      )}
    </>
  );
}
