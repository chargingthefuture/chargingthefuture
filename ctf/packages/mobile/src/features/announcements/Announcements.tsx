import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchAnnouncements, markAnnouncementRead } from './api';
import type { AnnouncementItem } from './api';

const COLOR = '#84CC16';
const BG = '#0F1117';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const DIMMER = '#4B5563';

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
  const urgent = isUrgent(item);
  const accent = '#A78BFA';

  return (
    <Pressable
      style={[styles.card, { borderColor: urgent ? '#EF444440' : BORDER }]}
      onPress={() => onRead(item.id)}
    >
      {urgent && (
        <View style={styles.urgentBadge}>
          <Text style={styles.urgentText}>URGENT</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: `${accent}25` }]}>
          <Text style={[styles.avatarText, { color: accent }]}>AH</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardAuthor}>Announcements Hub</Text>
          <Text style={styles.cardTime}>{formatTime(item.publishedAtIso)}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.cardBody} numberOfLines={4}>
        {item.body}
      </Text>
      {item.mandatory && (
        <View style={styles.mandatoryRow}>
          <View style={styles.mandatoryPill}>
            <Text style={styles.mandatoryText}>Required reading</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 28, color: `${COLOR}50` }}>📣</Text>
      </View>
      <Text style={styles.emptyTitle}>No announcements yet</Text>
      <Text style={styles.emptyBody}>
        Platform announcements from the Hub team will appear here as they are published.
      </Text>
    </View>
  );
}

export const Announcements = () => {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAnnouncements();
      setItems(data.items as AnnouncementItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={{ fontSize: 16, color: COLOR }}>📣</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Announcements</Text>
          <Text style={styles.headerSub}>Hub team updates · Live</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLOR} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
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
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    backgroundColor: '#090B0F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    color: TEXT,
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
    color: TEXT,
  },
  cardTime: {
    fontSize: 11,
    color: DIMMER,
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
    color: TEXT,
    lineHeight: 20,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13,
    color: SUBTLE,
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
