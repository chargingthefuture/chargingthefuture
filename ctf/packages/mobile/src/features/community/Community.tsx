import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchCommunityPosts, markCommunityItemRead } from './api';
import type { CommunityItem } from './api';

const COLOR = '#22C55E';
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

function categoryLabel(category: string): string {
  switch (category) {
    case 'peer_support': return 'Peer Support';
    case 'resource_share': return 'Resource Share';
    case 'event': return 'Event';
    default: return 'General';
  }
}

function CommunityCard({
  item,
  onRead,
}: {
  item: CommunityItem;
  onRead: (_id: string) => void;
}) {
  const category = item.community?.category ?? 'general';
  const replyCount = item.community?.replyCount ?? 0;
  const replies = item.community?.replies ?? [];

  return (
    <Pressable
      style={[styles.card, { borderColor: BORDER }]}
      onPress={() => onRead(item.id)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: `${COLOR}25` }]}>
          <Text style={[styles.avatarText, { color: COLOR }]}>C</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardCategory}>{categoryLabel(category)}</Text>
          <Text style={styles.cardTime}>{formatTime(item.publishedAtIso)}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.cardBody} numberOfLines={3}>
        {item.body}
      </Text>

      {replies.length > 0 && (
        <View style={styles.repliesBox}>
          <Text style={styles.repliesLabel}>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </Text>
          {replies.slice(0, 2).map((reply) => (
            <React.Fragment key={reply.id}>
              <Text style={styles.replyText} numberOfLines={2}>
                {reply.body}
              </Text>
            </React.Fragment>
          ))}
          {replyCount > 2 && (
            <Text style={styles.moreReplies}>+{replyCount - 2} more</Text>
          )}
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={[styles.typePill, { backgroundColor: `${COLOR}15`, borderColor: `${COLOR}30` }]}>
          <Text style={[styles.typePillText, { color: COLOR }]}>{categoryLabel(category)}</Text>
        </View>
        {replyCount > 0 && (
          <Text style={styles.replyCount}>{replyCount} replies</Text>
        )}
        {/* likes/hearts: no backing API field — omitted per real-data-only policy */}
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 28, color: `${COLOR}50` }}>👥</Text>
      </View>
      <Text style={styles.emptyTitle}>No community posts yet</Text>
      <Text style={styles.emptyBody}>
        Community posts, peer support, resource sharing, and events will appear here.
      </Text>
    </View>
  );
}

export const Community = () => {
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommunityPosts();
      setItems(data.items as CommunityItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load community posts.');
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
        await markCommunityItemRead(id);
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
          <Text style={{ fontSize: 16, color: COLOR }}>👥</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSub}>Peer posts and support · Live</Text>
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
            <CommunityCard item={item} onRead={handleRead} />
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
  cardCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: COLOR,
    letterSpacing: 0.5,
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
    marginBottom: 10,
  },
  repliesBox: {
    borderRadius: 10,
    backgroundColor: `${COLOR}08`,
    borderWidth: 1,
    borderColor: `${COLOR}20`,
    padding: 10,
    marginBottom: 10,
    gap: 4,
  },
  repliesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLOR,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  replyText: {
    fontSize: 12,
    color: SUBTLE,
    lineHeight: 18,
  },
  moreReplies: {
    fontSize: 11,
    color: COLOR,
    fontWeight: '600',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  replyCount: {
    fontSize: 12,
    color: DIMMER,
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
