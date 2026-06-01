/**
 * ChymeRoom — pixel-aligned Android screen for the Chyme social-audio plugin.
 *
 * Design source: design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/
 *   MobileChyme.tsx, MobileChymeLoading.tsx, MobileChymeEmpty.tsx
 *
 * States rendered:
 *   loading  → ChymeLoading (minimal branded splash per mockup)
 *   error    → inline error with retry (no mockup state; safe fallback)
 *   empty    → ChymeEmpty (no rooms live yet; backed by callActive === false + 0 participants)
 *   roomList → ChymeRoomList (room directory; one real room from GET /api/chyme/room)
 *   inRoom   → ChymeActiveRoom (stage/controls; backed by room.participants)
 *   chat     → ChymeChatView (companion text chat; GET+POST /api/chyme/messages)
 *
 * All data is real — bound to /api/chyme/* endpoints via api.ts.
 * No mock or fabricated data is rendered.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  deleteChymeProfile,
  deleteFullAccount,
  getChymeMobileIdentity,
  getChymeMessages,
  getChymeRoom,
  postChymeJoin,
  postChymeMessage,
} from './api';
import { ChymeLoading } from './chyme-loading';
import { ChymeEmpty } from './chyme-empty';
import { ChymeRoomList } from './chyme-room-list';
import { ChymeActiveRoom } from './chyme-active-room';
import { ChymeChatView } from './chyme-chat-view';
import type { ChatMessage } from './chyme-chat-view';

type ViewState = 'loading' | 'error' | 'empty' | 'roomList' | 'inRoom' | 'chat';

type RoomPayload = Awaited<ReturnType<typeof getChymeRoom>>;
type MessagePayload = Awaited<ReturnType<typeof getChymeMessages>>['messages'][number];

const PRIMARY = '#22C55E';

export const ChymeRoom: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'live' | 'upcoming'>('live');

  const identity = useMemo(() => {
    try {
      return getChymeMobileIdentity();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyme identity not configured.');
      setViewState('error');
      return null;
    }
  }, []);

  const loadRoom = useCallback(async () => {
    if (!identity) return;
    setViewState('loading');
    try {
      const [roomPayload, msgPayload] = await Promise.all([
        getChymeRoom(identity),
        getChymeMessages(identity),
      ]);
      setRoom(roomPayload);
      setMessages(msgPayload.messages ?? []);
      const hasParticipants = (roomPayload.participants?.length ?? 0) > 0;
      setViewState(hasParticipants ? 'roomList' : 'empty');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load Chyme room.');
      setViewState('error');
    }
  }, [identity]);

  useEffect(() => {
    if (identity) {
      void loadRoom();
    }
  }, [identity, loadRoom]);

  const handleJoinRoom = useCallback(async () => {
    if (!identity) return;
    try {
      const res = await postChymeJoin(identity);
      if (res.ok) {
        setViewState('inRoom');
        await loadRoom();
      }
    } catch (err) {
      Alert.alert('Join failed', err instanceof Error ? err.message : 'Unable to join room.');
    }
  }, [identity, loadRoom]);

  const handleSendMessage = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !identity || sending) return;
    setSending(true);
    try {
      const res = await postChymeMessage(identity, trimmed);
      setMessages((prev) => [...prev, res.message]);
      setChatInput('');
    } catch (err) {
      Alert.alert('Send failed', err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }, [chatInput, identity, sending]);

  const handleDeleteProfile = useCallback(async () => {
    if (!identity) return;
    try {
      await deleteChymeProfile(identity);
      setRoom(null);
      setMessages([]);
      setViewState('empty');
    } catch (err) {
      Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unable to delete profile.');
    }
  }, [identity]);

  const handleDeleteAccount = useCallback(async () => {
    if (!identity) return;
    try {
      const res = await deleteFullAccount(identity);
      Alert.alert('Requested', `Account deletion ${res.status}`);
    } catch (err) {
      Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unable to delete account.');
    }
  }, [identity]);

  if (viewState === 'loading') {
    return <ChymeLoading />;
  }

  if (viewState === 'error') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to load Chyme</Text>
        <Text style={styles.errorMsg}>{errorMsg ?? 'An unexpected error occurred.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadRoom}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (viewState === 'empty' || !room) {
    return <ChymeEmpty onStartRoom={handleJoinRoom} />;
  }

  if (viewState === 'chat') {
    const chatMessages: ChatMessage[] = messages.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      text: m.text,
      sentAtIso: m.sentAtIso,
    }));
    return (
      <ChymeChatView
        messages={chatMessages}
        input={chatInput}
        sending={sending}
        onChangeInput={setChatInput}
        onSend={handleSendMessage}
        onBack={() => setViewState('inRoom')}
      />
    );
  }

  if (viewState === 'inRoom') {
    return (
      <ChymeActiveRoom
        roomName={room.roomName}
        participants={room.participants}
        muted={muted}
        handRaised={handRaised}
        onToggleMute={() => setMuted((v) => !v)}
        onToggleHand={() => setHandRaised((v) => !v)}
        onOpenChat={() => setViewState('chat')}
        onLeave={() => setViewState('roomList')}
      />
    );
  }

  // viewState === 'roomList'
  return (
    <View style={styles.roomListContainer}>
      <ChymeRoomList
        room={{
          roomId: room.roomId,
          roomName: room.roomName,
          roomKey: room.roomKey,
          callActive: room.callActive,
          participantCount: room.participants.length,
        }}
        tab={tab}
        onTabChange={setTab}
        onJoinRoom={() => setViewState('inRoom')}
        onStartRoom={handleJoinRoom}
      />
      {/* Deletion actions: rendered below the room list; not in main mockup but required by contract */}
      <View style={styles.dangerZone}>
        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={() =>
            Alert.alert(
              'Delete Chyme Profile',
              'This will remove your Chyme messages and participant record.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: handleDeleteProfile },
              ],
            )
          }
        >
          <Text style={styles.dangerBtnText}>Delete Chyme Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={() =>
            Alert.alert(
              'Delete Full Account',
              'This will request full account deletion.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Request', style: 'destructive', onPress: handleDeleteAccount },
              ],
            )
          }
        >
          <Text style={styles.dangerBtnText}>Delete Full Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#021006',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0FDF4',
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  roomListContainer: { flex: 1, backgroundColor: '#021006' },
  dangerZone: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#052e16',
  },
  dangerBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
  },
  dangerBtnText: { color: '#F87171', fontSize: 13, fontWeight: '600' },
});
