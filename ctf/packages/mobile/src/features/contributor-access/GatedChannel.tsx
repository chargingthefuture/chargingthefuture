// Gated `#contributors` channel screen (Android). Mirrors the web gated-chat-panel.tsx behavior on
// the mobile Commons chat patterns (HubHome): DB-backed history over polling as the source of
// truth, optimistic send/reaction/delete reconciled by the next poll, Signal-style quoted replies,
// and a confirm-gated delete on the member's own posts. Deliberate differences from the Commons:
// the moderator-read disclosure always visible in the header, the twelve-emoji gated reaction set,
// the 4000-character limit, and NO image/file upload affordance anywhere (proposal hard
// guardrail). No live Stream layer here — the poll alone keeps the channel current, exactly like
// the web panel's polling-only fallback.
//
// Error posture (the no-teaser rule): a 404 from any channel route means "no access" — the screen
// calls `onUnavailable` so the caller silently removes the channel switch, with no error banner
// and no retry loop.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { useAuth } from '../../auth/auth-context';
import {
  deleteGatedMessage,
  fetchGatedMessages,
  sendGatedMessage,
  toggleGatedReaction,
  GATED_CHANNEL_DISPLAY_NAME,
  GATED_CHANNEL_MODERATOR_DISCLOSURE,
  GATED_MAX_MESSAGE_LENGTH,
  GATED_REACTION_EMOJIS,
} from './api';
import type { GatedChannelMessage, GatedReactionEmoji, GatedReactionSummary } from './api';

// Poll cadence — the poll is the only refresh path (no live layer on mobile); matches the web
// gated hook's polling-only interval.
const POLL_INTERVAL_MS = 10_000;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffMin = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

function avatarInitial(displayName: string): string {
  const source = displayName.replace(/^@/, '').trim();
  return source ? source.slice(0, 1).toUpperCase() : 'C';
}

type Styles = ReturnType<typeof makeStyles>;

// Recompute a message's reactions after the member toggles `emoji`, mirroring the server's toggle
// (same optimistic pattern as the Commons HubHome; the poll reconciles other members' counts).
function applyReactionToggle(message: GatedChannelMessage, emoji: GatedReactionEmoji): GatedChannelMessage {
  const existing = message.reactions.find((r) => r.emoji === emoji);
  let reactions: GatedReactionSummary[];
  if (existing && existing.reactedByMe) {
    const nextCount = existing.count - 1;
    reactions =
      nextCount <= 0
        ? message.reactions.filter((r) => r.emoji !== emoji)
        : message.reactions.map((r) => (r.emoji === emoji ? { ...r, count: nextCount, reactedByMe: false } : r));
  } else if (existing) {
    reactions = message.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r));
  } else {
    reactions = [...message.reactions, { emoji, count: 1, reactedByMe: true }];
  }
  const order = GATED_REACTION_EMOJIS as readonly string[];
  reactions = reactions.slice().sort((a, b) => order.indexOf(a.emoji) - order.indexOf(b.emoji));
  return { ...message, reactions };
}

function GatedMessageCard({
  message,
  s,
  isOwn,
  onToggleReaction,
  onReply,
  onDelete,
}: {
  message: GatedChannelMessage;
  s: Styles;
  isOwn: boolean;
  onToggleReaction: (_message: GatedChannelMessage, _emoji: GatedReactionEmoji) => void;
  onReply: (_message: GatedChannelMessage) => void;
  onDelete: (_message: GatedChannelMessage) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={[s.card, isOwn ? s.cardOwn : s.cardPeer]}>
      <View style={s.cardHeader}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{avatarInitial(message.displayName)}</Text>
        </View>
        <View style={s.cardMeta}>
          <Text style={s.cardName}>{message.displayName}</Text>
          <Text style={s.cardTime}>{formatTime(message.createdAtIso)}</Text>
        </View>
      </View>
      {message.quotedMessage && (
        <View style={s.quotedBlock}>
          <Text style={s.quotedAuthor} numberOfLines={1}>{message.quotedMessage.author}</Text>
          <Text style={s.quotedSnippet} numberOfLines={2}>{message.quotedMessage.snippet}</Text>
        </View>
      )}
      <Text style={s.cardBody}>{message.body}</Text>

      <View style={s.reactionRow}>
        {message.reactions.map((rx) => (
          <Pressable
            key={rx.emoji}
            style={[s.reactionPill, rx.reactedByMe ? s.reactionPillActive : null]}
            onPress={() => onToggleReaction(message, rx.emoji as GatedReactionEmoji)}
          >
            <Text style={s.reactionEmoji}>{rx.emoji}</Text>
            <Text style={[s.reactionCount, rx.reactedByMe ? s.reactionCountActive : null]}>{rx.count}</Text>
          </Pressable>
        ))}
        <Pressable
          style={s.reactionAdd}
          onPress={() => setShowPicker((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Add a reaction"
        >
          <Text style={s.reactionAddText}>{showPicker ? '×' : '＋'}</Text>
        </Pressable>
        {showPicker && (
          <View style={s.reactionPicker}>
            {GATED_REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                style={s.reactionPickerItem}
                onPress={() => {
                  setShowPicker(false);
                  onToggleReaction(message, emoji);
                }}
              >
                <Text style={s.reactionPickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable
          style={s.replyBtn}
          onPress={() => onReply(message)}
          accessibilityRole="button"
          accessibilityLabel="Reply to this post"
        >
          <Text style={s.replyBtnText}>↩ Reply</Text>
        </Pressable>
        {isOwn && (
          <Pressable
            style={s.deleteBtn}
            onPress={() => onDelete(message)}
            accessibilityRole="button"
            accessibilityLabel="Delete your post"
          >
            <Text style={s.deleteBtnText}>🗑 Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export const GatedChannel = ({ onUnavailable }: { onUnavailable: () => void }) => {
  const { tokens } = useTheme();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const s = useMemo(() => makeStyles(tokens), [tokens]);

  const [messages, setMessages] = useState<GatedChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<GatedChannelMessage | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // `onUnavailable` in a ref so the stable poll callback always reaches the caller's latest handler.
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchGatedMessages();
      if (data === null) {
        // Bare 404 — no access. Silent by design (no banner, no retry): the caller drops the
        // channel switch and the member sees exactly what a never-eligible member sees.
        onUnavailableRef.current();
        return;
      }
      setMessages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the channel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Pull-to-refresh: re-pull messages without flashing the loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const message = await sendGatedMessage(text, replyTo?.id ?? null);
      setInput('');
      setReplyTo(null);
      if (message === null) {
        onUnavailableRef.current();
        return;
      }
      // Optimistically append (the POST echoes a null quote; the next poll resolves the
      // authoritative quoted block, same as the web panel).
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      void load();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Unable to send your message.');
    } finally {
      setSending(false);
    }
  }, [input, sending, replyTo, load]);

  const handleToggleReaction = useCallback(
    async (message: GatedChannelMessage, emoji: GatedReactionEmoji) => {
      // Optimistic: flip immediately, then confirm. On failure, reload to the server truth.
      setMessages((prev) => prev.map((m) => (m.id === message.id ? applyReactionToggle(m, emoji) : m)));
      try {
        const result = await toggleGatedReaction(message.id, emoji);
        if (result === null) {
          onUnavailableRef.current();
        }
      } catch {
        void load();
      }
    },
    [load],
  );

  // Delete the member's own post. Confirms first (destructive, no undo — no edit exists in this
  // channel; delete and post again, same as the Commons). Optimistic; reload restores on failure.
  const handleDeletePost = useCallback(
    (message: GatedChannelMessage) => {
      Alert.alert(
        'Delete this message?',
        'This cannot be undone. To change it, delete and post again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setMessages((prev) => prev.filter((m) => m.id !== message.id));
              try {
                await deleteGatedMessage(message.id);
              } catch {
                void load();
              }
            },
          },
        ],
      );
    },
    [load],
  );

  return (
    <View style={s.screen}>
      {/* Channel header. The moderator-read disclosure is a hard requirement (proposal section 2):
          it must be plainly visible in the channel, so it lives here in the header, always. */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{GATED_CHANNEL_DISPLAY_NAME}</Text>
        <Text style={s.headerSub}>
          The contributor channel — earned through steady, broad participation.
        </Text>
        <Text style={s.headerNote}>👁 {GATED_CHANNEL_MODERATOR_DISCLOSURE}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={tokens.success} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={() => void load()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : messages.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyTitle}>Nothing posted yet</Text>
          <Text style={s.emptyBody}>
            This is the contributor channel. Threads, a wider reaction set, and longer messages —
            start the first conversation.
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GatedMessageCard
              message={item}
              s={s}
              isOwn={currentUserId != null && item.authorUserId === currentUserId}
              onToggleReaction={handleToggleReaction}
              onReply={setReplyTo}
              onDelete={handleDeletePost}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={tokens.success} />}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {sendError && <Text style={s.sendError}>{sendError}</Text>}
        {replyTo && (
          <View style={s.replyBanner}>
            <View style={s.replyBannerBar} />
            <View style={s.replyBannerBody}>
              <Text style={s.replyBannerLabel} numberOfLines={1}>
                Replying to {replyTo.displayName}
              </Text>
              <Text style={s.replyBannerSnippet} numberOfLines={1}>
                {replyTo.body}
              </Text>
            </View>
            <Pressable
              style={s.replyBannerCancel}
              onPress={() => setReplyTo(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
            >
              <Text style={s.replyBannerCancelText}>×</Text>
            </Pressable>
          </View>
        )}
        {/* Text-only composer — deliberately no attach/upload affordance of any kind. */}
        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            maxLength={GATED_MAX_MESSAGE_LENGTH}
            placeholder="Write to the contributor channel…"
            placeholderTextColor={tokens.textMuted}
            multiline
            editable={!sending}
          />
          <Pressable
            style={[s.sendBtn, input.trim() ? s.sendBtnActive : null]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={tokens.isComic ? tokens.bg : '#fff'} />
            ) : (
              <Text style={[s.sendBtnText, input.trim() ? s.sendBtnTextActive : null]}>Send</Text>
            )}
          </Pressable>
        </View>
        <Text style={s.footnote}>{GATED_CHANNEL_MODERATOR_DISCLOSURE} No images here — text only.</Text>
      </KeyboardAvoidingView>
    </View>
  );
};

function makeStyles(t: ThemeTokens) {
  const r = t.radius;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: t.isComic ? 2 : 1,
      borderBottomColor: t.isComic ? t.border : t.borderFaint,
      gap: 3,
    },
    headerTitle: { fontSize: 15, fontWeight: '800', color: t.textPrimary },
    headerSub: { fontSize: 12, color: t.textSecondary, lineHeight: 17 },
    headerNote: { fontSize: 11, fontWeight: '600', color: t.textMuted },
    list: { padding: 16, gap: 10 },
    card: { borderRadius: r, borderWidth: t.isComic ? 1.5 : 1, padding: 14, marginBottom: 10 },
    // Same bubble convention as the Commons: peers use the community/success accent, the member's
    // own posts a neutral gray.
    cardPeer: { backgroundColor: `${t.success}12`, borderColor: `${t.success}30` },
    cardOwn: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: t.isComic ? 0 : 8,
      backgroundColor: t.isComic ? `${t.success}18` : `${t.success}22`,
      borderWidth: t.isComic ? 1 : 0,
      borderColor: `${t.success}40`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 11, fontWeight: '800', color: t.isComic ? t.textPrimary : t.success },
    cardMeta: { flex: 1 },
    cardName: { fontSize: 13, fontWeight: '700', color: t.textPrimary },
    cardTime: { fontSize: 11, color: t.textSecondary, marginTop: 1 },
    cardBody: { fontSize: 13, color: t.isComic ? t.textPrimary : '#D1D5DB', lineHeight: 21 },
    quotedBlock: {
      borderLeftWidth: 3,
      borderLeftColor: `${t.success}66`,
      backgroundColor: t.isComic ? `${t.success}10` : 'rgba(255,255,255,0.03)',
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 8,
    },
    quotedAuthor: { fontSize: 11, fontWeight: '700', color: t.success, marginBottom: 1 },
    quotedSnippet: { fontSize: 12, color: t.textSecondary },
    reactionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    reactionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radiusChip,
      backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: t.isComic ? `${t.border}40` : 'rgba(255,255,255,0.1)',
    },
    reactionPillActive: {
      backgroundColor: `${t.success}1F`,
      borderColor: `${t.success}66`,
    },
    reactionEmoji: { fontSize: 13 },
    reactionCount: { fontSize: 11, fontWeight: '700', color: t.textSecondary },
    reactionCountActive: { color: t.success },
    reactionAdd: {
      width: 28,
      height: 26,
      borderRadius: t.radiusChip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: t.isComic ? `${t.border}40` : 'rgba(255,255,255,0.1)',
    },
    reactionAddText: { fontSize: 14, fontWeight: '700', color: t.textSecondary },
    reactionPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: t.radiusChip,
      backgroundColor: t.surfaceAlt,
      borderWidth: 1,
      borderColor: t.isComic ? t.border : t.borderFaint,
    },
    reactionPickerItem: { paddingHorizontal: 4, paddingVertical: 2 },
    reactionPickerEmoji: { fontSize: 18 },
    replyBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: t.radiusChip },
    replyBtnText: { fontSize: 11, fontWeight: '700', color: t.textSecondary },
    deleteBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: t.radiusChip },
    deleteBtnText: { fontSize: 11, fontWeight: '700', color: t.isComic ? t.textSecondary : '#F87171' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    errorText: { fontSize: 14, color: t.danger, textAlign: 'center', marginBottom: 16 },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: r,
      backgroundColor: `${t.success}20`,
      borderWidth: 1,
      borderColor: `${t.success}40`,
    },
    retryText: { fontSize: 13, fontWeight: '700', color: t.success },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, marginBottom: 10, textAlign: 'center' },
    emptyBody: { fontSize: 14, color: t.textSecondary, lineHeight: 22, textAlign: 'center' },
    sendError: { fontSize: 12, color: t.danger, paddingHorizontal: 16, paddingTop: 8 },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: t.surfaceAlt,
      borderTopWidth: t.isComic ? 2 : 1,
      borderTopColor: t.isComic ? t.border : t.borderFaint,
    },
    replyBannerBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: t.success },
    replyBannerBody: { flex: 1 },
    replyBannerLabel: { fontSize: 12, fontWeight: '700', color: t.success },
    replyBannerSnippet: { fontSize: 12, color: t.textSecondary, marginTop: 1 },
    replyBannerCancel: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    replyBannerCancelText: { fontSize: 18, color: t.textSecondary },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.surfaceAlt,
      borderTopWidth: t.isComic ? 2 : 1,
      borderTopColor: t.isComic ? t.border : t.borderFaint,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      borderRadius: r,
      backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.04)',
      borderWidth: t.isComic ? 2 : 1,
      borderColor: t.isComic ? `${t.border}60` : 'rgba(255,255,255,0.1)',
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: t.textPrimary,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: r,
      backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.06)',
      borderWidth: t.isComic ? 1.5 : 0,
      borderColor: `${t.borderDim}60`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnActive: { backgroundColor: t.isComic ? t.border : '#0EA5E9', borderColor: t.border },
    sendBtnText: { fontSize: 12, fontWeight: '700', color: t.textSecondary },
    sendBtnTextActive: { color: t.isComic ? t.bg : '#fff' },
    footnote: {
      fontSize: 11,
      color: t.textMuted,
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: t.surfaceAlt,
    },
  });
}
