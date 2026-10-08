// The room under the Join row, copied from the web (web components/chyme/chyme-room-view.tsx): the
// room header with its live badge, name, participant line and Chat button; the quota notice and the
// hand-raise notice when there is something to say; then either the live call or, before joining,
// the readings loop (main room, nobody live), the stage and the chat.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lock, MessageSquare } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { chymeHandle, type ChymeRoomResponse, type ChymeRoomScope } from './ChymeApi';
import { useChymeTokens, type ChymeTokens } from './chyme-tokens';
import { ChymeStage } from './chyme-stage';
import { ChymeChatPanel } from './chyme-chat-panel';
import { ChymeAudioRoom } from './ChymeAudioRoom';
import { ChymeReadingsPlayer } from './chyme-readings-player';
import type { MobileModerationContext } from './ChymeModeration';
import type { MobileBackChannelController } from './useChymeBackChannel';
import type { ChymeRoomState } from './useChymeRoomState';

export type CurrentUser = { userId: string; username: string | null };

// The web's chymeParticipantLine (lib/chyme/capacity-line.ts): the plain count, the cap named only
// from 80% of it, and signed-out listeners as a second number.
export function participantLine(current: number, max: number, guests: number): string {
  let members = `${current} ${current === 1 ? 'participant' : 'participants'}`;
  if (max > 0 && current >= max) members = `${current} of ${max} participants · full`;
  else if (max > 0 && current >= Math.ceil(max * 0.8)) members = `${current} of ${max} participants · nearly full`;
  if (guests <= 0) return members;
  return `${members} · ${guests} ${guests === 1 ? 'guest' : 'guests'} listening`;
}

function RoomHeader({ room, user, showChat, onToggleChat, t }: { room: ChymeRoomResponse; user: CurrentUser; showChat: boolean; onToggleChat: () => void; t: ChymeTokens }) {
  return (
    <View style={[styles.header, { borderBottomColor: t.BORDER }]}>
      <View style={styles.headerMain}>
        <View style={styles.badgeRow}>
          <View style={[styles.dot, { borderRadius: t.radius(4), backgroundColor: t.ACCENT }]} />
          <View style={[styles.liveBadge, { borderRadius: t.radius(20), backgroundColor: `${t.ACCENT}15`, borderColor: `${t.ACCENT}30` }]}>
            <Text style={[styles.liveText, { color: t.ACCENT }]}>{room.callActive ? '🔴 Live' : 'Idle'}</Text>
          </View>
          <Text style={[styles.membersOnly, { color: t.FAINT }]}>Members-Only Room</Text>
          <Lock size={12} color={t.FAINT} />
        </View>
        <Text style={[styles.roomName, { color: t.TITLE }]}>{room.roomName}</Text>
        <Text style={styles.line}>
          {participantLine(room.participants.length, room.capacity.max, room.guestCount ?? 0)} · Signed in as {chymeHandle(user.username, user.userId)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onToggleChat}
        accessibilityRole="button"
        style={[
          styles.chatButton,
          {
            borderRadius: t.radius(10),
            backgroundColor: showChat ? `${t.ACCENT}20` : t.INPUT_BG,
            borderColor: showChat ? `${t.ACCENT}40` : t.BORDER_STRONG,
          },
        ]}
      >
        <MessageSquare size={14} color={showChat ? t.ACCENT : t.SUBTLE} />
        <Text style={[styles.chatText, { color: showChat ? t.ACCENT : t.SUBTLE }]}>Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

// The member-facing quota line, only while the quota policy has something to say.
function QuotaNotice({ room, t }: { room: ChymeRoomResponse; t: ChymeTokens }) {
  if (!room.quota.notice) return null;
  const severe = room.quota.band === 'red';
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        {
          borderRadius: t.radius(10),
          backgroundColor: severe ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
          borderColor: severe ? 'rgba(239,68,68,0.35)' : 'rgba(234,179,8,0.35)',
        },
      ]}
    >
      <Text style={[styles.noticeText, { color: severe ? '#FCA5A5' : '#FDE68A' }]}>{room.quota.notice}</Text>
    </View>
  );
}

function HandRaiseNotice({ room, t }: { room: ChymeRoomResponse; t: ChymeTokens }) {
  if (room.speakMode !== 'hand_raise') return null;
  return (
    <View accessibilityRole="alert" style={[styles.notice, styles.handNotice, { borderRadius: t.radius(10) }]}>
      <Text style={styles.handNoticeText}>Hand-raise mode: everyone listens until an admin lets them speak. Raise your hand to ask.</Text>
    </View>
  );
}

type ViewProps = {
  state: ChymeRoomState;
  room: ChymeRoomResponse;
  user: CurrentUser;
  scope: ChymeRoomScope;
  backChannel: MobileBackChannelController | null;
};

function useModeration(room: ChymeRoomResponse, scope: ChymeRoomScope): MobileModerationContext {
  return useMemo(
    () => ({
      roomScope: scope,
      speakMode: room.speakMode ?? 'open',
      viewer: room.viewer ?? { isAdmin: false, role: 'listener' },
      memberRoles: new Map(room.participants.map((p) => [p.userId, p.role] as const)),
    }),
    [scope, room.speakMode, room.viewer, room.participants],
  );
}

export function ChymeRoomView({ state, room, user, scope, backChannel }: ViewProps) {
  const t = useChymeTokens();
  const raisedHandUserIds = useMemo(() => new Set(room.participants.filter((p) => p.handRaised).map((p) => p.userId)), [room.participants]);
  const moderation = useModeration(room, scope);
  const { chat, call } = state;
  const chatPanel = (
    <ChymeChatPanel
      messages={state.messages}
      currentUserId={user.userId}
      draft={chat.draft}
      onDraftChange={chat.setDraft}
      onSend={() => void chat.send()}
      sending={chat.sending}
      onEditMessage={chat.edit}
      onDeleteMessage={(id) => void chat.remove(id)}
    />
  );
  const inCall = call.joinState === 'ready' && call.joinInfo !== null;

  return (
    <>
      <RoomHeader room={room} user={user} showChat={state.showChat} onToggleChat={() => state.setShowChat((s) => !s)} t={t} />
      <QuotaNotice room={room} t={t} />
      <HandRaiseNotice room={room} t={t} />
      {inCall && call.joinInfo ? (
        <ChymeAudioRoom
          joinInfo={call.joinInfo}
          displayName={chymeHandle(user.username, user.userId)}
          roomScope={scope}
          showChat={state.showChat}
          chatPanel={chatPanel}
          onLeave={() => void call.leave()}
          raisedHandUserIds={raisedHandUserIds}
          backChannel={backChannel}
          onConnectionChange={call.setConnection}
          moderation={moderation}
        />
      ) : (
        <View>
          {scope === 'main' && !room.callActive ? (
            <View style={styles.readings}>
              <ChymeReadingsPlayer />
            </View>
          ) : null}
          <ChymeStage room={room} currentUserId={user.userId} />
          {state.showChat ? chatPanel : null}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 20, paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1 },
  headerMain: { flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  dot: { width: 8, height: 8 },
  liveBadge: { paddingVertical: 2, paddingHorizontal: 10, borderWidth: 1 },
  liveText: { fontSize: 11, fontFamily: interFamily('400') },
  membersOnly: { fontSize: 12, fontFamily: interFamily('400') },
  roomName: { fontSize: 20, lineHeight: 26, marginBottom: 4, fontFamily: interFamily('800') },
  line: { fontSize: 13, color: '#16A34A', fontFamily: interFamily('400') },
  chatButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1 },
  chatText: { fontSize: 13, fontFamily: interFamily('600') },
  notice: { marginTop: 12, marginHorizontal: 24, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  noticeText: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
  handNotice: { paddingVertical: 8, backgroundColor: 'rgba(234,179,8,0.10)', borderColor: 'rgba(234,179,8,0.3)' },
  handNoticeText: { fontSize: 12, lineHeight: 18, color: '#FDE68A', fontFamily: interFamily('400') },
  readings: { paddingHorizontal: 24 },
});
