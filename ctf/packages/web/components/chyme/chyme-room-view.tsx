'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, chymeHandle, type CurrentUser } from './chyme-shared';
import { ChymeStage } from './chyme-stage';
import { ChymeReadingsPlayer } from '@/components/chyme/readings/chyme-readings-player';
import type { ChymeJoinResponse, ChymeRoomResponse } from 'lib/chyme/types';
import type { ChymeConnectionState } from './chyme-audio-room';
import type { ChymeModerationContext } from './chyme-moderation';
import { chymeParticipantLine } from 'lib/chyme/capacity-line';

// The live audio room pulls in the Stream Video SDK, which is browser-only, so
// it is loaded on the client and never server-rendered.
const ChymeAudioRoom = dynamic(() => import('./chyme-audio-room').then((m) => m.ChymeAudioRoom), {
  ssr: false,
});

export type ChymeRoomViewProps = {
  room: ChymeRoomResponse;
  currentUser: CurrentUser;
  joinInfo: ChymeJoinResponse | null;
  joinReady: boolean;
  onLeave: () => void;
  roomScope: 'main' | 'contributors';
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

// The room before the member joins the call: the stage, and the readings loop while it is switched
// on and the main room is idle (temporary module, 2026-09-28). The main room opens by itself, so this
// is where members land; joining the call unmounts it, which stops the sound.
function ChymeIdleStage({ room, currentUserId, roomScope }: { room: ChymeRoomResponse; currentUserId: string; roomScope: ChymeRoomViewProps['roomScope'] }) {
  const showReadings = roomScope === 'main' && !room.callActive;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {showReadings ? (
        <div style={{ padding: '0 24px' }}>
          <ChymeReadingsPlayer />
        </div>
      ) : null}
      <ChymeStage room={room} currentUserId={currentUserId} />
    </div>
  );
}

export function ChymeRoomView(props: ChymeRoomViewProps) {
  const { room, currentUser, joinInfo, joinReady } = props;
  const { theme } = useTheme();
  const t = getChymeTokens(theme);

  // Clerk user ids of members whose hand is raised, derived from the polled room state. Passed to
  // the audio room so each stage tile shows a persistent raised hand for everyone but the local
  // member (who is driven by their own instant toggle).
  const raisedHandUserIds = useMemo(
    () => new Set(room.participants.filter((p) => p.handRaised).map((p) => p.userId)),
    [room.participants],
  );

  // Speak mode, who is viewing, and every member's role, for the moderation controls and the
  // listener's microphone notice. Refreshed with every room poll.
  const moderation = useMemo<ChymeModerationContext>(
    () => ({
      roomScope: props.roomScope,
      speakMode: room.speakMode,
      viewer: room.viewer,
      memberRoles: new Map(room.participants.map((p) => [p.userId, p.role] as const)),
    }),
    [props.roomScope, room.speakMode, room.viewer, room.participants],
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
              {chymeParticipantLine(room.participants.length, room.capacity.max, room.guestCount)} · Signed in as {chymeHandle(currentUser.username, currentUser.userId)}
            </div>
          </div>
        </div>
      </div>

      <ChymeQuotaNotice notice={room.quota.notice} band={room.quota.band} />
      {room.speakMode === 'hand_raise' ? (
        <div role="status" style={{ margin: '12px 24px 0', padding: '8px 14px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, background: 'rgba(234,179,8,0.10)', border: '1px solid rgba(234,179,8,0.3)', color: '#FDE68A' }}>
          Hand-raise mode: everyone listens until an admin lets them speak. Raise your hand to ask.
        </div>
      ) : null}

      {inCall && joinInfo ? (
        <ChymeAudioRoom
          joinInfo={joinInfo}
          currentUser={currentUser}
          isMobile={true}
          onLeave={props.onLeave}
          raisedHandUserIds={raisedHandUserIds}
          roomScope={props.roomScope}
          backChannelAllowed={room.quota.backChannelAllowed}
          onConnectionChange={props.onConnectionChange}
          moderation={moderation}
        />
      ) : (
        <ChymeIdleStage room={room} currentUserId={currentUser.userId} roomScope={props.roomScope} />
      )}
    </>
  );
}
