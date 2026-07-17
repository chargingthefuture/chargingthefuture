import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  joinSession,
  postMessage,
  PEER_PROGRAMMING_MAX_MESSAGE_LENGTH,
  type PeerProgrammingCohort,
  type PeerProgrammingMessage,
  type PeerProgrammingSessionCredentials,
  type PeerProgrammingTopic,
} from './api';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { PeerProgrammingSessionCall } from './PeerProgrammingSessionCall';

type Props = {
  cohort: PeerProgrammingCohort;
  topic: PeerProgrammingTopic | null;
  messages: PeerProgrammingMessage[];
  // True when the viewer is listening in on a cohort they were not placed in (or an admin viewing
  // another cohort): the session is read-only — no live-video join (the call is always the caller's
  // own cohort, so a listener cannot start the viewed cohort's call), and no message composer.
  readOnly?: boolean;
  // Re-pull the room after a message posts so the new message appears in the thread. The room
  // endpoint is the source of truth for the open cohort's messages (mirrors the web shell).
  onMessageSent?: () => void | Promise<void>;
};

// What the live-video panel is doing right now.
//   idle            — showing the Join Session button.
//   joining         — the credential request is in flight.
//   in-call         — credentials minted; the live call is rendered.
//   no-cohort       — 404: the member is not in a cohort yet.
//   stream-disabled — 503: GetStream is not configured server-side.
//   error           — any other failure; message shown with a retry.
type VideoState =
  | { kind: 'idle' }
  | { kind: 'joining' }
  | { kind: 'in-call'; credentials: PeerProgrammingSessionCredentials }
  | { kind: 'no-cohort' }
  | { kind: 'stream-disabled' }
  | { kind: 'error'; message: string };

const MessageRow = ({ item }: { item: PeerProgrammingMessage }) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
  <View style={styles.messageRow}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{item.authorUserId.slice(0, 2).toUpperCase()}</Text>
    </View>
    <View style={styles.messageBubble}>
      <Text style={styles.messageBody}>{item.body}</Text>
      <Text style={styles.messageTime}>
        {new Date(item.createdAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  </View>
  );
};

const VideoPanel = ({ readOnly }: { readOnly?: boolean }) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [video, setVideo] = useState<VideoState>({ kind: 'idle' });

  const handleJoin = async () => {
    setVideo({ kind: 'joining' });
    const result = await joinSession();
    if (result.status === 'ok') {
      setVideo({ kind: 'in-call', credentials: result.credentials });
    } else if (result.status === 'no-cohort') {
      setVideo({ kind: 'no-cohort' });
    } else if (result.status === 'stream-disabled') {
      setVideo({ kind: 'stream-disabled' });
    } else {
      setVideo({ kind: 'error', message: result.message });
    }
  };

  if (video.kind === 'in-call') {
    return (
      <View style={styles.videoCard}>
        <PeerProgrammingSessionCall
          credentials={video.credentials}
          displayName={video.credentials.displayName}
          onLeave={() => setVideo({ kind: 'idle' })}
        />
      </View>
    );
  }

  // Listening in on another cohort: live video is the caller's own cohort, so do not offer a join
  // here. Surface a short explanation instead.
  if (readOnly) {
    return (
      <View style={styles.videoCard}>
        <Text style={styles.videoIcon}>🎥</Text>
        <Text style={styles.videoTitle}>Live video</Text>
        <Text style={styles.videoHint}>Open your own cohort&#39;s Session tab to join its live video call.</Text>
      </View>
    );
  }

  return (
    <View style={styles.videoCard}>
      <Text style={styles.videoIcon}>🎥</Text>
      <Text style={styles.videoTitle}>Live video session</Text>
      {video.kind === 'no-cohort' && (
        <Text style={styles.videoHint}>You&#39;re not in a cohort yet. Join a cohort to access live sessions.</Text>
      )}
      {video.kind === 'stream-disabled' && (
        <Text style={styles.videoHint}>Live video is unavailable right now. The cohort text room still works.</Text>
      )}
      {video.kind === 'error' && <Text style={styles.videoError}>{video.message}</Text>}
      {video.kind === 'no-cohort' || video.kind === 'stream-disabled' ? null : (
        <TouchableOpacity
          style={[styles.joinBtn, video.kind === 'joining' && styles.joinBtnDisabled]}
          onPress={() => {
            void handleJoin();
          }}
          disabled={video.kind === 'joining'}
          accessibilityRole="button"
          accessibilityLabel="Join Session"
        >
          {video.kind === 'joining' ? (
            <View style={styles.joinBtnRow}>
              <ActivityIndicator size="small" color="#04160A" />
              <Text style={styles.joinBtnText}>Connecting…</Text>
            </View>
          ) : (
            <Text style={styles.joinBtnText}>{video.kind === 'error' ? 'Try again' : 'Join Session'}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

// Bottom-pinned message composer for cohort members. Sends via POST /api/peer-programming/messages
// (the existing postMessage client), clears on success, disables while sending, and asks the parent
// to re-pull the room so the new message shows. Mirrors the web composer's constraints: non-empty and
// at most PEER_PROGRAMMING_MAX_MESSAGE_LENGTH characters.
const Composer = ({
  cohortId,
  onMessageSent,
}: {
  cohortId: string;
  onMessageSent?: () => void | Promise<void>;
}) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = input.trim();
  const canSend = trimmed.length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    if (trimmed.length > PEER_PROGRAMMING_MAX_MESSAGE_LENGTH) {
      setError(`Keep it under ${PEER_PROGRAMMING_MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await postMessage(cohortId, trimmed);
      setInput('');
      await onMessageSent?.();
    } catch {
      setError('Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.composer}>
      {error !== null && <Text style={styles.composerError}>{error}</Text>}
      <View style={styles.composerRow}>
        <TextInput
          style={styles.composerInput}
          value={input}
          onChangeText={setInput}
          placeholder="Message your cohort…"
          placeholderTextColor={tokens.textMuted}
          multiline
          maxLength={PEER_PROGRAMMING_MAX_MESSAGE_LENGTH}
          editable={!sending}
          accessibilityLabel="Message your cohort"
        />
        <TouchableOpacity
          style={[styles.sendBtn, canSend ? styles.sendBtnActive : styles.sendBtnDisabled]}
          onPress={() => {
            void handleSend();
          }}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator size="small" color="#04160A" />
          ) : (
            <Text style={[styles.sendBtnIcon, !canSend && styles.sendBtnIconDisabled]}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const PeerProgrammingSessionTab = ({ cohort, topic, messages, readOnly, onMessageSent }: Props) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
  <View style={styles.root}>
    <View style={styles.sessionHeader}>
      <Text style={styles.sessionTitle}>{cohort.cohortLabel}</Text>
      {topic !== null && <Text style={styles.sessionSubtitle}>{topic.title}</Text>}
    </View>
    {readOnly ? (
      <View style={styles.listenNotice}>
        <Text style={styles.listenNoticeText}>👂 You&#39;re listening in — read-only.</Text>
      </View>
    ) : null}
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MessageRow item={item} />}
      ListHeaderComponent={<VideoPanel readOnly={readOnly} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No messages yet. Be the first to post in your cohort.</Text>
        </View>
      }
      contentContainerStyle={styles.messageList}
      style={styles.list}
    />
    {readOnly ? null : <Composer cohortId={cohort.id} onMessageSent={onMessageSent} />}
  </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  root: { flex: 1 },
  sessionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
  },
  sessionTitle: { fontSize: 15, fontWeight: '700', color: t.textPrimary, marginBottom: 2 },
  sessionSubtitle: { fontSize: 12, color: t.textSecondary },
  listenNotice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: `${accent}12`,
    borderBottomWidth: 1,
    borderBottomColor: `${accent}25`,
  },
  listenNoticeText: { fontSize: 12, fontWeight: '600', color: accent },
  list: { flex: 1 },
  messageList: { padding: 16 },
  videoCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: `${accent}30`,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  videoIcon: { fontSize: 40, marginBottom: 10 },
  videoTitle: { fontSize: 16, fontWeight: '700', color: t.textPrimary, marginBottom: 6 },
  videoHint: { fontSize: 13, color: t.textSecondary, textAlign: 'center', lineHeight: 20 },
  videoError: { fontSize: 13, color: '#F87171', textAlign: 'center', lineHeight: 20, marginTop: 4 },
  joinBtn: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: accent,
  },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: '#04160A' },
  messageRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${accent}25`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: accent },
  messageBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: t.radius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
  },
  messageBody: { fontSize: 13, color: t.textShell, lineHeight: 18, marginBottom: 4 },
  messageTime: { fontSize: 10, color: t.textSecondary },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 22 },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: t.borderFaint,
    backgroundColor: t.surfaceAlt,
  },
  composerError: { fontSize: 12, color: '#F87171', marginBottom: 8 },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: `${accent}30`,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  composerInput: {
    flex: 1,
    fontSize: 14,
    color: t.textShell,
    maxHeight: 120,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: accent },
  sendBtnDisabled: { backgroundColor: `${accent}25` },
  sendBtnIcon: { fontSize: 18, fontWeight: '800', color: '#04160A' },
  sendBtnIconDisabled: { color: t.textMuted },
  });
}
