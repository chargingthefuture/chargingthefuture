import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeName, type ThemeTokens } from '../../theme';
import { fetchHubMessages, sendHubMessage } from './api';
import type { HubMessage } from './api';

// The Hub stream is feed-backed and flattened on the server to one author shape per message:
// "Survivor Hub" for admin announcements + AI Q&A, "Community member" for peer-to-peer posts.
function isOfficial(message: HubMessage): boolean {
  return message.displayName === 'Survivor Hub';
}

function avatarInitials(message: HubMessage): string {
  if (isOfficial(message)) return 'SH';
  const source = message.displayName.trim();
  if (!source) return 'C';
  return source.slice(0, 1).toUpperCase();
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffMin = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

// A stable dedup key mirroring the web shell's (from, sender, text, time) tuple so an optimistic
// send and the next polled copy collapse into one row.
function dedupKey(message: HubMessage): string {
  return `${message.userId}|${message.displayName}|${message.text}|${message.sentAtIso}`;
}

type Styles = ReturnType<typeof makeStyles>;

function MessageCard({ message, s, tokens, theme }: { message: HubMessage; s: Styles; tokens: ThemeTokens; theme: ThemeName }) {
  const official = isOfficial(message);
  // Official posts use the Hub brand (chyme accent in comic). Community posts use the
  // success/green accent. Both come from the active theme so they switch with the toggle.
  const accent = official ? getAppAccent('chyme', theme) : tokens.success;

  return (
    <View style={[s.card, official ? s.cardOfficial : s.cardCommunity]}>
      <View style={s.cardHeader}>
        <View style={[s.avatar, { backgroundColor: tokens.isComic ? `${accent}18` : `${accent}22`, borderWidth: tokens.isComic ? 1 : 0, borderColor: `${accent}40` }]}>
          <Text style={[s.avatarText, { color: tokens.isComic ? tokens.textPrimary : accent }]}>
            {avatarInitials(message)}
          </Text>
        </View>
        <View style={s.cardMeta}>
          <View style={s.cardNameRow}>
            <Text style={s.cardName}>{message.displayName}</Text>
            {official && (
              <View style={s.officialBadge}>
                <Text style={s.officialBadgeText}>Official</Text>
              </View>
            )}
          </View>
          <Text style={s.cardTime}>{formatTime(message.sentAtIso)}</Text>
        </View>
      </View>
      <Text style={s.cardBody}>{message.text}</Text>
    </View>
  );
}

function EmptyState({ s }: { s: Styles }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <Text style={{ fontSize: 28 }}>💬</Text>
      </View>
      <Text style={s.emptyTitle}>Nothing posted yet</Text>
      <Text style={s.emptyBody}>
        Announcements, answers, and community posts will appear here. Be the first to share an update.
      </Text>
    </View>
  );
}

export const HubHome = () => {
  const { tokens, theme } = useTheme();
  const s = useMemo(() => makeStyles(tokens, theme), [tokens, theme]);

  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const seenKeys = useRef<Set<string>>(new Set());

  const mergeMessages = useCallback((incoming: HubMessage[]) => {
    const merged: HubMessage[] = [];
    const keys = new Set<string>();
    for (const message of incoming) {
      const key = dedupKey(message);
      if (keys.has(key)) continue;
      keys.add(key);
      merged.push(message);
    }
    seenKeys.current = keys;
    setMessages(merged);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchHubMessages();
      mergeMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the Hub.');
    } finally {
      setLoading(false);
    }
  }, [mergeMessages]);

  useEffect(() => {
    load();
    // Poll while the screen is mounted, mirroring the web shell's polling cadence.
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const result = await sendHubMessage(text);
      setInput('');
      // Optimistically append; dedup against the next poll by tuple key.
      const key = dedupKey(result.message);
      if (!seenKeys.current.has(key)) {
        seenKeys.current.add(key);
        setMessages((prev) => [...prev, result.message]);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Unable to send your message.');
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const hubAccent = getAppAccent('chyme', theme);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarText}>SH</Text>
        </View>
        <View>
          <Text style={s.headerTitle}>Survivor Hub</Text>
          <Text style={s.headerSub}>Community · Live</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={hubAccent} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : messages.length === 0 ? (
        <EmptyState s={s} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageCard message={item} s={s} tokens={tokens} theme={theme} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {sendError && <Text style={s.sendError}>{sendError}</Text>}
        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Share an update with the community…"
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
      </KeyboardAvoidingView>
    </View>
  );
};

function makeStyles(t: ThemeTokens, theme: ThemeName) {
  const r = t.radius;
  const official = getAppAccent('chyme', theme);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: t.isComic ? 2 : 1,
      borderBottomColor: t.isComic ? t.border : t.borderFaint,
    },
    headerAvatar: {
      width: 36,
      height: 36,
      borderRadius: t.isComic ? 0 : 10,
      backgroundColor: t.isComic ? t.surface : official,
      borderWidth: t.isComic ? 2 : 0,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarText: { fontSize: 13, fontWeight: '800', color: t.isComic ? t.border : '#fff' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary, letterSpacing: t.isComic ? 0.6 : 0, textTransform: t.isComic ? 'uppercase' : 'none' },
    headerSub: { fontSize: 11, color: t.success },
    list: { padding: 16, gap: 10 },
    card: { borderRadius: r, borderWidth: t.isComic ? 1.5 : 1, padding: 14, marginBottom: 10 },
    cardOfficial: { backgroundColor: t.isComic ? `${official}10` : 'rgba(124,58,237,0.07)', borderColor: t.isComic ? `${official}50` : 'rgba(124,58,237,0.22)' },
    cardCommunity: { backgroundColor: t.surface, borderColor: t.isComic ? `${t.border}40` : t.borderFaint },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    avatar: { width: 28, height: 28, borderRadius: t.isComic ? 0 : 8, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 11, fontWeight: '800' },
    cardMeta: { flex: 1 },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardName: { fontSize: 13, fontWeight: '700', color: t.textPrimary, letterSpacing: t.isComic ? 0.4 : 0 },
    officialBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: t.radiusChip, backgroundColor: t.isComic ? 'transparent' : 'rgba(124,58,237,0.2)', borderWidth: t.isComic ? 1 : 0, borderColor: `${t.border}40` },
    officialBadgeText: { fontSize: 10, fontWeight: t.isComic ? '700' : '600', color: t.isComic ? t.border : '#A78BFA', letterSpacing: t.isComic ? 0.6 : 0, textTransform: t.isComic ? 'uppercase' : 'none' },
    cardTime: { fontSize: 11, color: t.textSecondary, marginTop: 1 },
    cardBody: { fontSize: 13, color: t.isComic ? t.textPrimary : '#D1D5DB', lineHeight: 21 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    errorText: { fontSize: 14, color: t.danger, textAlign: 'center', marginBottom: 16 },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: r, backgroundColor: t.isComic ? `${t.border}14` : 'rgba(124,58,237,0.2)', borderWidth: t.isComic ? 1.5 : 1, borderColor: t.isComic ? t.border : 'rgba(124,58,237,0.4)' },
    retryText: { fontSize: 13, fontWeight: '700', color: t.isComic ? t.textPrimary : '#A78BFA' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: t.isComic ? 0 : 36,
      backgroundColor: t.isComic ? `${t.border}12` : 'rgba(124,58,237,0.12)',
      borderWidth: t.isComic ? 2 : 1,
      borderColor: t.isComic ? t.border : 'rgba(124,58,237,0.3)',
      borderStyle: t.isComic ? 'solid' : 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, marginBottom: 10, textAlign: 'center' },
    emptyBody: { fontSize: 14, color: t.textSecondary, lineHeight: 22, textAlign: 'center' },
    sendError: { fontSize: 12, color: t.danger, paddingHorizontal: 16, paddingTop: 8 },
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
    sendBtn: { width: 44, height: 44, borderRadius: r, backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.06)', borderWidth: t.isComic ? 1.5 : 0, borderColor: `${t.borderDim}60`, alignItems: 'center', justifyContent: 'center' },
    sendBtnActive: { backgroundColor: t.isComic ? t.border : '#0EA5E9', borderColor: t.border },
    sendBtnText: { fontSize: 12, fontWeight: '700', color: t.textSecondary },
    sendBtnTextActive: { color: t.isComic ? t.bg : '#fff' },
  });
}
