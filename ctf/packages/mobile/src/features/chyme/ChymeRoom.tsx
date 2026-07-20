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
 *   inRoom   → ChymeAudioRoom (LIVE audio stage via the Stream Video SDK; you
 *              hear and speak in real time, with one tile per live participant)
 *   chat     → ChymeChatView (companion text chat; GET+POST /api/chyme/messages)
 *
 * All data is real — bound to /api/chyme/* endpoints via api.ts. The live audio
 * room joins the same Stream call as the web room, using the same Stream user
 * token (POST /api/chyme/join). No mock or fabricated data is rendered.
 *
 * NOTE: the live audio needs native WebRTC code, so the in-room screen only
 * works in an EAS dev/production build — not in Expo Go (see app.config.ts).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  chymeHandle,
  getChymeMessages,
  getChymeRoom,
  postChymeJoin,
  postChymeMessage,
} from './api';
import type { ChymeJoinResponse } from './ChymeApi';
import { ChymeLoading } from './chyme-loading';
import { ChymeEmpty } from './chyme-empty';
import { ChymeRoomList } from './chyme-room-list';
import { ChymeAudioRoom } from './ChymeAudioRoom';
import { ChymeChatView } from './chyme-chat-view';
import type { ChatMessage } from './chyme-chat-view';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';

type ViewState = 'loading' | 'error' | 'empty' | 'roomList' | 'inRoom' | 'chat';

type RoomPayload = Awaited<ReturnType<typeof getChymeRoom>>;
type MessagePayload = Awaited<ReturnType<typeof getChymeMessages>>['messages'][number];

export const ChymeRoom: React.FC = () => {
  const { tokens, theme } = useTheme();
  const styles = React.useMemo(() => makeStyles(tokens), [tokens]);
  const accent = getAppAccent('chyme', theme);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [joinInfo, setJoinInfo] = useState<ChymeJoinResponse | null>(null);
  const [joining, setJoining] = useState(false);
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'live' | 'upcoming'>('live');
  const [refreshing, setRefreshing] = useState(false);

  // `background` skips the branded splash so pull-to-refresh keeps the room list visible.
  const loadRoom = useCallback(async (background = false) => {
    if (!background) setViewState('loading');
    try {
      const [roomPayload, msgPayload] = await Promise.all([getChymeRoom(), getChymeMessages()]);
      setRoom(roomPayload);
      setMessages(msgPayload.messages ?? []);
      const hasParticipants = (roomPayload.participants?.length ?? 0) > 0;
      setViewState(hasParticipants ? 'roomList' : 'empty');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load Chyme room.');
      setViewState('error');
    }
  }, []);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  // Pull-to-refresh on the room list: re-pull room data without flashing the splash.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRoom(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadRoom]);

  const handleJoinRoom = useCallback(async () => {
    if (joining) return;
    setJoining(true);
    try {
      // POST /api/chyme/join mints the Stream credentials (api key, call id,
      // user id, and the user token that serves both chat and audio). We hold
      // onto them so the live audio room can join the same Stream call.
      const res = await postChymeJoin();
      if (res.ok) {
        // Hold the join credentials and switch to the live audio room. The live
        // participant list comes from Stream in real time, so we do NOT re-run
        // loadRoom here — that would flip viewState back to the room list.
        setJoinInfo(res);
        setViewState('inRoom');
      }
    } catch (err) {
      Alert.alert('Join failed', err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setJoining(false);
    }
  }, [joining]);

  const handleLeaveRoom = useCallback(() => {
    setJoinInfo(null);
    setViewState('roomList');
  }, []);

  const handleSendMessage = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await postChymeMessage(trimmed);
      setMessages((prev) => [...prev, res.message]);
      setChatInput('');
    } catch (err) {
      Alert.alert('Send failed', err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }, [chatInput, sending]);

  if (viewState === 'loading') {
    return <ChymeLoading />;
  }

  if (viewState === 'error') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to load Chyme</Text>
        <Text style={styles.errorMsg}>{errorMsg ?? 'An unexpected error occurred.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void loadRoom()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (viewState === 'empty' || !room) {
    return <ChymeEmpty onStartRoom={handleJoinRoom} tokens={tokens} accent={accent} />;
  }

  if (viewState === 'chat') {
    const chatMessages: ChatMessage[] = messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.username,
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

  if (viewState === 'inRoom' && joinInfo) {
    return (
      <ChymeAudioRoom
        joinInfo={joinInfo}
        // Fallback display name only. The server already upserts each Chyme
        // user's real handle to Stream, so participant tiles show that handle;
        // this is just the local label until the server name resolves.
        displayName={chymeHandle(null, joinInfo.streamUserId.replace(/^chyme-/, ''))}
        onOpenChat={() => setViewState('chat')}
        onLeave={handleLeaveRoom}
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
        onJoinRoom={handleJoinRoom}
        onStartRoom={handleJoinRoom}
        tokens={tokens}
        accent={accent}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
};

function makeStyles(t: ThemeTokens) {
  // Default theme keeps the deep-green Chyme chrome; comic theme uses the ink palette.
  const bg = t.isComic ? t.bg : '#04160A';
  return StyleSheet.create({
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: bg,
      paddingHorizontal: 24,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      fontFamily: interFamily('700'),
      color: t.isComic ? t.textPrimary : '#F0FDF4',
      marginBottom: 8,
    },
    errorMsg: {
      fontSize: 14,
      fontFamily: interFamily('400'),
      color: t.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 22,
    },
    retryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: t.radius,
      backgroundColor: t.isComic ? t.surface : t.success,
      borderWidth: t.isComic ? 1.5 : 0,
      borderColor: t.border,
    },
    retryBtnText: { color: t.isComic ? t.border : '#fff', fontWeight: '700', fontSize: 15, fontFamily: interFamily('700') },
    roomListContainer: { flex: 1, backgroundColor: bg },
  });
}
