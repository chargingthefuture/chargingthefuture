'use client';

import type { RefObject } from 'react';
import { Lock, MessageSquare } from 'lucide-react';
import { BORDER, PRIMARY, type CurrentUser } from './chyme-shared';
import { ChymeStage } from './chyme-stage';
import { ChymeChatPanel } from './chyme-chat-panel';
import { ChymeControls } from './chyme-controls';
import type { ChymeJoinResponse, ChymeMessage, ChymeRoomResponse } from 'lib/chyme/types';

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
  muted: boolean;
  onToggleMute: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
  onLeave: () => void;
};

export function ChymeRoomView(props: ChymeRoomViewProps) {
  const { room, currentUser, showChat, onToggleChat } = props;
  return (
    <>
      <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIMARY, boxShadow: `0 0 8px ${PRIMARY}` }} />
              <span style={{ background: `${PRIMARY}15`, color: PRIMARY, border: `1px solid ${PRIMARY}30`, fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>
                {room.callActive ? '🔴 Live' : 'Idle'}
              </span>
              <span style={{ fontSize: 12, color: '#4B5563' }}>Safe Space Room</span>
              <Lock size={12} style={{ color: '#4B5563' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F0FDF4', lineHeight: 1.3, marginBottom: 4 }}>{room.roomName}</div>
            <div style={{ fontSize: 13, color: '#16A34A' }}>{room.participants.length} participants · Signed in as {currentUser.displayName}</div>
          </div>
          <button
            onClick={onToggleChat}
            style={{ padding: '8px 14px', borderRadius: 10, background: showChat ? `${PRIMARY}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${showChat ? PRIMARY + '40' : 'rgba(255,255,255,0.08)'}`, color: showChat ? PRIMARY : '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MessageSquare size={14} /> Chat
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ChymeStage
          room={room}
          currentUserId={currentUser.userId}
          joinInfo={props.joinInfo}
          joinReady={props.joinReady}
        />
        {showChat && (
          <ChymeChatPanel
            messages={props.messages}
            currentUserId={currentUser.userId}
            draft={props.draft}
            onDraftChange={props.onDraftChange}
            onSend={props.onSend}
            sending={props.sending}
            messagesEndRef={props.messagesEndRef}
          />
        )}
      </div>

      <ChymeControls
        muted={props.muted}
        onToggleMute={props.onToggleMute}
        handRaised={props.handRaised}
        onToggleHand={props.onToggleHand}
        joinReady={props.joinReady}
        onLeave={props.onLeave}
      />
    </>
  );
}
