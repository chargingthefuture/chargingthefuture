import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { fetchHubMessages, sendHubMessage } from './api';
import type { HubMessage } from './api';

// Palette pulled from the locked mobile mockups (MobileHome.tsx / MobileHubPublic.tsx).
const BG = '#0F1117';
const HEADER_BG = '#090B0F';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const DIMMER = '#4B5563';
const BRAND = '#7C3AED';
const BRAND_LIGHT = '#A78BFA';
const CYAN = '#0EA5E9';
const BORDER = 'rgba(255,255,255,0.06)';

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

function MessageCard({ message }: { message: HubMessage }) {
  const official = isOfficial(message);
  const accent = official ? BRAND_LIGHT : '#22C55E';

  return (
    <View style={[styles.card, official ? styles.cardOfficial : styles.cardCommunity]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, official ? styles.avatarOfficial : { backgroundColor: `${accent}22` }]}>
          <Text style={[styles.avatarText, official ? styles.avatarTextOfficial : { color: accent }]}>
            {avatarInitials(message)}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName}>{message.displayName}</Text>
            {official && (
              <View style={styles.officialBadge}>
                <Text style={styles.officialBadgeText}>Official</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTime}>{formatTime(message.sentAtIso)}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{message.text}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 28 }}>💬</Text>
      </View>
      <Text style={styles.emptyTitle}>Nothing posted yet</Text>
      <Text style={styles.emptyBody}>
        Announcements, answers, and community posts will appear here. Be the first to share an update.
      </Text>
    </View>
  );
}

export const HubHome = () => {
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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>SH</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Survivor Hub</Text>
          <Text style={styles.headerSub}>Community · Live</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND_LIGHT} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : messages.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageCard message={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {sendError && <Text style={styles.sendError}>{sendError}</Text>}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Share an update with the community…"
            placeholderTextColor={DIMMER}
            multiline
            editable={!sending}
          />
          <Pressable
            style={[styles.sendBtn, input.trim() ? styles.sendBtnActive : null]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.sendBtnText, input.trim() ? styles.sendBtnTextActive : null]}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
  },
  headerSub: {
    fontSize: 11,
    color: '#22C55E',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardOfficial: {
    backgroundColor: 'rgba(124,58,237,0.07)',
    borderColor: 'rgba(124,58,237,0.22)',
  },
  cardCommunity: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOfficial: {
    backgroundColor: BRAND,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '800',
  },
  avatarTextOfficial: {
    color: '#fff',
  },
  cardMeta: {
    flex: 1,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  officialBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(124,58,237,0.2)',
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: BRAND_LIGHT,
  },
  cardTime: {
    fontSize: 11,
    color: DIMMER,
    marginTop: 1,
  },
  cardBody: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 21,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND_LIGHT,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: SUBTLE,
    lineHeight: 22,
    textAlign: 'center',
  },
  sendError: {
    fontSize: 12,
    color: '#F87171',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HEADER_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#E8EAF0',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: CYAN,
  },
  sendBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: DIMMER,
  },
  sendBtnTextActive: {
    color: '#fff',
  },
});
