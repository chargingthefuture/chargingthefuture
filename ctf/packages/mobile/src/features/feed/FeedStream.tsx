import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchFeedTimeline, markFeedItemRead } from './api';
import type { FeedChannel, FeedTimelineItem } from './api';
import {
  ComicAnswerCard,
  ComicComposer,
  ComicPendingCard,
  fetchComicConversation,
  rateComicAnswer,
} from '../comic';
import type { ComicAnswerRating, ComicStreamItem } from '../comic';
import { useTheme, type ThemeTokens } from '../../theme';

// The shipped feed accent. The feed hub has no PLUGIN_ACCENTS entry (it is not a plugin),
// so there is no sanctioned theme mapping for it — kept raw.
const COLOR = '#84CC16';

// "URGENT" items: mandatory=true or priority>=80
function isUrgent(item: FeedTimelineItem): boolean {
  return item.mandatory || item.priority >= 80;
}

function itemAccentColor(item: FeedTimelineItem): string {
  if (item.itemType === 'announcement') return '#A78BFA';
  if (item.itemType === 'community') return '#22C55E';
  return '#38BDF8'; // question
}

function itemTypeLabel(item: FeedTimelineItem): string {
  if (item.itemType === 'announcement') return 'ANNOUNCEMENT';
  if (item.itemType === 'community') return 'COMMUNITY';
  return 'QUESTION';
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMin = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

function avatarInitials(item: FeedTimelineItem): string {
  if (item.itemType === 'announcement') return 'AH';
  if (item.itemType === 'community') return 'C';
  return 'Q';
}

const CHANNELS: { key: FeedChannel; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'announcements', label: 'Alerts' },
  { key: 'community', label: 'Community' },
  { key: 'questions', label: 'Q&A' },
];

// A feed list row is either a feed timeline item or one of the asker's own @comic Q&A cards.
type FeedRow =
  | { kind: 'feed'; key: string; feed: FeedTimelineItem }
  | { kind: 'comic'; key: string; comic: ComicStreamItem };

// ---------- sub-components ----------

function LoadingState() {
  // Loading screens are exempt from theming (comic token spec §11) — static styles by design.
  return (
    <View style={loadingStyles.loadingWrap}>
      <Text style={loadingStyles.loadingText}>EXIT THEIR ECONOMY</Text>
      <Text style={loadingStyles.loadingText}>EXIT THE PSYOP</Text>
      <ActivityIndicator size="small" color={`${COLOR}80`} style={{ marginTop: 20 }} />
    </View>
  );
}

function EmptyState() {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 28, color: `${COLOR}50` }}>📣</Text>
      </View>
      <Text style={styles.emptyTitle}>Nothing posted yet</Text>
      <Text style={styles.emptyBody}>
        Be the first to share an update, resource, or announcement with the community.
      </Text>
    </View>
  );
}

function FeedCard({
  item,
  onRead,
}: {
  item: FeedTimelineItem;
  onRead: (_id: string) => void;
}) {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const accent = itemAccentColor(item);
  const urgent = isUrgent(item);
  const borderColor = urgent ? `${tokens.danger}40` : tokens.border;

  return (
    <Pressable
      style={[styles.card, { borderColor }]}
      onPress={() => onRead(item.id)}
    >
      {urgent && (
        <View style={styles.urgentBadge}>
          <Text style={styles.urgentText}>URGENT</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: `${accent}25` }]}>
          <Text style={[styles.avatarText, { color: accent }]}>
            {avatarInitials(item)}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardAuthor}>{itemTypeLabel(item)}</Text>
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
      <View style={styles.cardFooter}>
        <View style={[styles.typePill, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
          <Text style={[styles.typePillText, { color: accent }]}>{itemTypeLabel(item)}</Text>
        </View>
        {/* likes / comments: no backing API field — omitted per real-data-only policy */}
      </View>
    </Pressable>
  );
}

// ---------- main screen ----------

export const FeedStream = () => {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [channel, setChannel] = useState<FeedChannel>('all');
  const [items, setItems] = useState<FeedTimelineItem[]>([]);
  const [comicItems, setComicItems] = useState<ComicStreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const loadComic = useCallback(async () => {
    try {
      const conversation = await fetchComicConversation();
      setComicItems(conversation);
    } catch {
      // The @comic conversation is supplementary to the feed; a failure here must not blank the
      // feed. Leave whatever we had.
    }
  }, []);

  const load = useCallback(
    async (ch: FeedChannel) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchFeedTimeline(ch);
        setItems(data.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load feed.');
      } finally {
        setLoading(false);
      }
      await loadComic();
    },
    [loadComic],
  );

  useEffect(() => {
    load(channel);
  }, [channel, load]);

  const handleRead = useCallback(
    async (id: string) => {
      if (readIds.has(id)) return;
      setReadIds((prev) => new Set(prev).add(id));
      try {
        await markFeedItemRead(id);
      } catch {
        // fire-and-forget; UI still marks locally
      }
    },
    [readIds],
  );

  const handleRate = useCallback(
    async (turnId: string, rating: ComicAnswerRating) => {
      // Optimistically reflect the rating; the server enforces one rating per (user, turn).
      setComicItems((prev) =>
        prev.map((entry) =>
          entry.answerTurnId === turnId ? { ...entry, currentUserRating: rating } : entry,
        ),
      );
      try {
        await rateComicAnswer(turnId, rating);
      } catch {
        // Re-sync from the server on failure so the row reflects the true state.
        loadComic();
      }
    },
    [loadComic],
  );

  // The @comic cards (the asker's own Q&A) lead the stream; the feed timeline follows. The @comic
  // surfaces are only shown on the unfiltered "All" channel and the "Q&A" channel so the dedicated
  // alert/community tabs stay focused.
  const showComic = channel === 'all' || channel === 'questions';
  const rows: FeedRow[] = [
    ...(showComic
      ? comicItems.map<FeedRow>((comic) => ({ kind: 'comic', key: `comic-${comic.questionTurnId}`, comic }))
      : []),
    ...items.map<FeedRow>((feed) => ({ kind: 'feed', key: `feed-${feed.id}`, feed })),
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 16, color: COLOR }}>📣</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Feed</Text>
            <Text style={styles.headerSub}>Community pulse · Live</Text>
          </View>
        </View>
      </View>

      {/* Channel tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {CHANNELS.map((ch) => (
          <Pressable
            key={ch.key}
            style={[
              styles.tab,
              channel === ch.key && styles.tabActive,
            ]}
            onPress={() => setChannel(ch.key)}
          >
            <Text
              style={[
                styles.tabText,
                channel === ch.key && styles.tabTextActive,
              ]}
            >
              {ch.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(channel)}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item: row }) => {
            if (row.kind === 'comic') {
              return row.comic.status === 'answered' ? (
                <View style={styles.comicSlot}>
                  <ComicAnswerCard item={row.comic} askedByLabel="You" onRate={handleRate} />
                </View>
              ) : (
                <View style={styles.comicSlot}>
                  <ComicPendingCard item={row.comic} askedByLabel="You" />
                </View>
              );
            }
            return <FeedCard item={row.feed} onRead={handleRead} />;
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* @comic composer */}
      <ComicComposer onAsked={loadComic} />
    </View>
  );
};

// Loading-screen styles stay static: the comic token spec (§11) exempts loading
// screens from theming, so these deliberately never read the theme tokens.
const loadingStyles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 24,
    textAlign: 'center',
  },
});

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
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
    tabBar: {
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      flexGrow: 0,
    },
    tabBarContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
      flexDirection: 'row',
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    tabActive: {
      backgroundColor: `${COLOR}20`,
      borderColor: `${COLOR}50`,
    },
    tabText: {
      fontSize: 12,
      color: t.textSecondary,
      fontWeight: '600',
    },
    tabTextActive: {
      color: COLOR,
    },
    list: {
      padding: 16,
      gap: 12,
    },
    comicSlot: {
      marginBottom: 12,
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
      borderRadius: t.radiusChip,
      backgroundColor: `${t.danger}15`,
      borderWidth: 1,
      borderColor: `${t.danger}30`,
      marginBottom: 8,
    },
    urgentText: {
      fontSize: 10,
      fontWeight: '700',
      color: t.danger,
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
      fontSize: 11,
      fontWeight: '700',
      color: t.textSecondary,
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
      marginBottom: 12,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
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
    errorWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
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
