import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { fetchAnnouncements, markAnnouncementRead } from './api';
import type { AnnouncementItem } from './api';

// Announcements hub accent — the shipped lime the header, unread dots, and empty state use. It is
// the hub's own accent (no registered plugin slug), so it stays a raw constant while the chrome
// (background, borders, text) reads the theme tokens.
const COLOR = '#84CC16';

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMin = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

function isUrgent(item: AnnouncementItem): boolean {
  return item.mandatory || item.priority >= 80;
}

function AnnouncementCard({
  item,
  onRead,
}: {
  item: AnnouncementItem;
  onRead: (_id: string) => void;
}) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const urgent = isUrgent(item);
  const accent = '#A78BFA';

  return (
    <Pressable
      style={[s.card, { borderColor: urgent ? '#EF444440' : tokens.border }]}
      onPress={() => onRead(item.id)}
    >
      {urgent && (
        <View style={s.urgentBadge}>
          <Text style={s.urgentText}>URGENT</Text>
        </View>
      )}
      <View style={s.cardHeader}>
        <View style={[s.avatar, { backgroundColor: `${accent}25` }]}>
          <Text style={[s.avatarText, { color: accent }]}>AH</Text>
        </View>
        <View style={s.cardMeta}>
          <Text style={s.cardAuthor}>Announcements Hub</Text>
          <Text style={s.cardTime}>{formatTime(item.publishedAtIso)}</Text>
        </View>
        {!item.isRead && <View style={s.unreadDot} />}
      </View>
      <Text style={s.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={s.cardBody} numberOfLines={4}>
        {item.body}
      </Text>
      {item.mandatory && (
        <View style={s.mandatoryRow}>
          <View style={s.mandatoryPill}>
            <Text style={s.mandatoryText}>Required reading</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function EmptyState() {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <Text style={{ fontSize: 28, color: `${COLOR}50` }}>📣</Text>
      </View>
      <Text style={s.emptyTitle}>No announcements yet</Text>
      <Text style={s.emptyBody}>
        Platform announcements from the Hub team will appear here as they are published.
      </Text>
    </View>
  );
}

export const Announcements = () => {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // `background` skips the full-screen spinner so pull-to-refresh keeps the current list visible.
  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const data = await fetchAnnouncements();
      setItems(data.items as AnnouncementItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load announcements.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh: re-pull announcements without flashing the loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleRead = useCallback(
    async (id: string) => {
      if (readIds.has(id)) return;
      setReadIds((prev) => new Set(prev).add(id));
      try {
        await markAnnouncementRead(id);
      } catch {
        // fire-and-forget
      }
    },
    [readIds],
  );

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerIcon}>
          <Text style={{ fontSize: 16, color: COLOR }}>📣</Text>
        </View>
        <View>
          <Text style={s.headerTitle}>Announcements</Text>
          <Text style={s.headerSub}>Hub team updates · Live</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLOR} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={() => load()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AnnouncementCard item={item} onRead={handleRead} />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR} />}
        />
      )}
    </View>
  );
};

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: t.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: t.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: COLOR,
  },
  list: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444430',
    marginBottom: 8,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  cardMeta: {
    flex: 1,
  },
  cardAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: t.textPrimary,
  },
  cardTime: {
    fontSize: 11,
    color: t.textMuted,
    marginTop: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLOR,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: t.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  mandatoryRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  mandatoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#F97316' + '20',
    borderWidth: 1,
    borderColor: '#F97316' + '40',
  },
  mandatoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F97316',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: t.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: t.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: t.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR,
  },
  });
}
