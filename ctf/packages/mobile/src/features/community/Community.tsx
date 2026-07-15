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
import { fetchCommunityPosts, markCommunityItemRead } from './api';
import type { CommunityItem } from './api';

// Community hub accent — the shipped green the header, avatars, pills, and unread dots use. It is
// the hub's own accent (no registered plugin slug), so it stays a raw constant while the chrome
// (background, borders, text) reads the theme tokens.
const COLOR = '#22C55E';

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
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const category = item.community?.category ?? 'general';
  const replyCount = item.community?.replyCount ?? 0;
  const replies = item.community?.replies ?? [];

  return (
    <Pressable
      style={s.card}
      onPress={() => onRead(item.id)}
    >
      <View style={s.cardHeader}>
        <View style={[s.avatar, { backgroundColor: `${COLOR}25` }]}>
          <Text style={[s.avatarText, { color: COLOR }]}>C</Text>
        </View>
        <View style={s.cardMeta}>
          <Text style={s.cardCategory}>{categoryLabel(category)}</Text>
          <Text style={s.cardTime}>{formatTime(item.publishedAtIso)}</Text>
        </View>
        {!item.isRead && <View style={s.unreadDot} />}
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={s.cardBody} numberOfLines={3}>
        {item.body}
      </Text>

      {replies.length > 0 && (
        <View style={s.repliesBox}>
          <Text style={s.repliesLabel}>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </Text>
          {replies.slice(0, 2).map((reply) => (
            <React.Fragment key={reply.id}>
              <Text style={s.replyText} numberOfLines={2}>
                {reply.body}
              </Text>
            </React.Fragment>
          ))}
          {replyCount > 2 && (
            <Text style={s.moreReplies}>+{replyCount - 2} more</Text>
          )}
        </View>
      )}

      <View style={s.cardFooter}>
        <View style={[s.typePill, { backgroundColor: `${COLOR}15`, borderColor: `${COLOR}30` }]}>
          <Text style={[s.typePillText, { color: COLOR }]}>{categoryLabel(category)}</Text>
        </View>
        {replyCount > 0 && (
          <Text style={s.replyCount}>{replyCount} replies</Text>
        )}
        {/* likes/hearts: no backing API field — omitted per real-data-only policy */}
      </View>
    </Pressable>
  );
}

function EmptyState() {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <Text style={{ fontSize: 28, color: `${COLOR}50` }}>👥</Text>
      </View>
      <Text style={s.emptyTitle}>No community posts yet</Text>
      <Text style={s.emptyBody}>
        Community posts, peer support, resource sharing, and events will appear here.
      </Text>
    </View>
  );
}

export const Community = () => {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // `background` skips the full-screen spinner so pull-to-refresh keeps the current list visible.
  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const data = await fetchCommunityPosts();
      setItems(data.items as CommunityItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load community posts.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh: re-pull community posts without flashing the loading state.
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
        await markCommunityItemRead(id);
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
          <Text style={{ fontSize: 16, color: COLOR }}>👥</Text>
        </View>
        <View>
          <Text style={s.headerTitle}>Community</Text>
          <Text style={s.headerSub}>Peer posts and support · Live</Text>
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
            <CommunityCard item={item} onRead={handleRead} />
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
    borderColor: t.border,
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
    color: t.textSecondary,
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
    color: t.textMuted,
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
