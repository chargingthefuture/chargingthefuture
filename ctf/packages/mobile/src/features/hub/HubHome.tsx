import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeName, type ThemeTokens } from '../../theme';
import { useAuth } from '../../auth/auth-context';
import {
  fetchHubMessages,
  sendHubMessage,
  deleteHubMessage,
  toggleHubReaction,
  fetchHubLastSeen,
  markHubSeen,
  fetchHubChannels,
  HUB_REACTION_EMOJIS,
} from './api';
import type { HubMessage, HubReactionEmoji, HubReactionSummary, HubStreamFilter } from './api';
import { GatedChannel, GATED_CHANNEL_SLUG, GATED_CHANNEL_DISPLAY_NAME } from '../contributor-access';
import {
  fetchHubJoin,
  connectHubLive,
  type HubLiveConnection,
  type HubTypingUser,
} from './live-stream';
import { UnlockVerifyBanner } from '../unlock';

// Poll cadence: the poll is the only refresh path when the live Stream connection is absent or
// degraded. When the live connection is healthy, real-time events drive refreshes and the poll is a
// slow backstop only, so it runs far less often to cut request volume. Mirrors the web shell.
const POLL_INTERVAL_FALLBACK_MS = 15_000;
const POLL_INTERVAL_LIVE_MS = 30_000;

// Render "X is typing…" / "X and Y are typing…" / "N people are typing…" from the set of other
// members currently typing. Empty list renders nothing.
function formatTypingLabel(users: HubTypingUser[]): string | null {
  if (users.length === 0) return null;
  if (users.length === 1) return `${users[0].name} is typing…`;
  if (users.length === 2) return `${users[0].name} and ${users[1].name} are typing…`;
  return `${users.length} people are typing…`;
}

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

// The @-form other members type to mention this member: `@<username>` when set, otherwise the
// stable `@user-<id token>` pseudonym. Mirrors the web `lib/feed/author-handle.ts`
// (feedAuthorHandle / feedMentionTokens) — the server derives the same forms for the filter;
// this copy only labels the mentions empty state.
function mentionLabelFor(username: string | null | undefined, userId: string | null | undefined): string {
  if (username) return `@${username}`;
  if (userId) {
    const base = userId.startsWith('user_') ? userId.slice(5) : userId;
    const token = (base.slice(0, 8) || userId.slice(0, 8)).toLowerCase();
    if (token) return `@user-${token}`;
  }
  return '@you';
}

type Styles = ReturnType<typeof makeStyles>;

// Recompute a message's reactions after the member toggles `emoji`, mirroring the server's toggle:
// a tap adds the member's reaction (or removes it if already on). Used for an instant optimistic
// update; the 15s poll reconciles other members' counts.
function applyReactionToggle(message: HubMessage, emoji: HubReactionEmoji): HubMessage {
  const existing = message.reactions.find((r) => r.emoji === emoji);
  let reactions: HubReactionSummary[];
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
  const order = HUB_REACTION_EMOJIS as readonly string[];
  reactions = reactions.slice().sort((a, b) => order.indexOf(a.emoji) - order.indexOf(b.emoji));
  return { ...message, reactions };
}

function MessageCard({
  message,
  s,
  tokens,
  theme,
  canReact,
  onToggleReaction,
  canReply,
  onReply,
  onDelete,
  currentUserId,
}: {
  message: HubMessage;
  s: Styles;
  tokens: ThemeTokens;
  theme: ThemeName;
  canReact: boolean;
  onToggleReaction: (_message: HubMessage, _emoji: HubReactionEmoji) => void;
  canReply: boolean;
  onReply: (_message: HubMessage) => void;
  onDelete: (_message: HubMessage) => void;
  currentUserId?: string;
}) {
  const official = isOfficial(message);
  // Official posts use the Hub brand (chyme accent in comic). Community posts use the
  // success/green accent. Both come from the active theme so they switch with the toggle.
  const accent = official ? getAppAccent('chyme', theme) : tokens.success;
  // Bubble color convention (web parity): the logged-in member's own community posts are gray;
  // everyone else's use the hub/community color. Official posts keep the Hub brand treatment.
  const isOwn = !official && currentUserId != null && message.userId === currentUserId;
  // Only peer posts (community posts) can be reacted to / replied to; announcements / AI cannot.
  const isPeer = message.communityPostId != null;
  // The member can delete their own peer post (there is no edit — delete and repost instead).
  const canDelete = isOwn && isPeer;
  const showActionsRow = isPeer && (message.reactions.length > 0 || canReact || canReply || canDelete);
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={[s.card, official ? s.cardOfficial : isOwn ? s.cardCommunityOwn : s.cardCommunity]}>
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
      {message.quotedMessage && (
        <View style={s.quotedBlock}>
          <Text style={s.quotedAuthor} numberOfLines={1}>{message.quotedMessage.author}</Text>
          <Text style={s.quotedSnippet} numberOfLines={2}>{message.quotedMessage.snippet}</Text>
        </View>
      )}
      {/* An announcement carries its heading separately (the web API splits it out of the body);
          render it above the body so mobile matches the web official card and no title is lost. */}
      {message.title ? <Text style={s.cardTitle}>{message.title}</Text> : null}
      <Text style={s.cardBody}>{message.text}</Text>
      {message.linkedPlugin ? (
        <Pressable
          style={s.linkedPluginChip}
          onPress={() => { void Linking.openURL(`https://app.chargingthefuture.com/apps/${message.linkedPlugin!.slug}`); }}
          accessibilityRole="button"
          accessibilityLabel={`Open ${message.linkedPlugin.name}`}
        >
          <Text style={s.linkedPluginChipText}>↗ Open {message.linkedPlugin.name}</Text>
        </Pressable>
      ) : null}

      {showActionsRow && (
        <View style={s.reactionRow}>
          {message.reactions.map((rx) => (
            <Pressable
              key={rx.emoji}
              style={[s.reactionPill, rx.reactedByMe ? s.reactionPillActive : null]}
              onPress={canReact ? () => onToggleReaction(message, rx.emoji as HubReactionEmoji) : undefined}
              disabled={!canReact}
            >
              <Text style={s.reactionEmoji}>{rx.emoji}</Text>
              <Text style={[s.reactionCount, rx.reactedByMe ? s.reactionCountActive : null]}>{rx.count}</Text>
            </Pressable>
          ))}
          {canReact && (
            <Pressable
              style={s.reactionAdd}
              onPress={() => setShowPicker((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Add a reaction"
            >
              <Text style={s.reactionAddText}>{showPicker ? '×' : '＋'}</Text>
            </Pressable>
          )}
          {canReact && showPicker && (
            <View style={s.reactionPicker}>
              {HUB_REACTION_EMOJIS.map((emoji) => (
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
          {canReply && (
            <Pressable
              style={s.replyBtn}
              onPress={() => onReply(message)}
              accessibilityRole="button"
              accessibilityLabel="Reply to this post"
            >
              <Text style={s.replyBtnText}>↩ Reply</Text>
            </Pressable>
          )}
          {canDelete && (
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
      )}
    </View>
  );
}

function EmptyState({
  s,
  mentionsOnly,
  announcementsOnly,
  mentionLabel,
}: {
  s: Styles;
  mentionsOnly: boolean;
  announcementsOnly: boolean;
  mentionLabel: string;
}) {
  const icon = mentionsOnly ? '@' : announcementsOnly ? '📣' : '💬';
  const title = mentionsOnly ? 'No mentions yet' : announcementsOnly ? 'No announcements yet' : 'Nothing posted yet';
  const body = mentionsOnly
    ? `When someone writes ${mentionLabel}, it shows here.`
    : announcementsOnly
      ? 'Official updates from the team show here.'
      : 'Announcements, answers, and community posts will appear here. Be the first to share an update.';
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <Text style={{ fontSize: 28 }}>{icon}</Text>
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  );
}

export const HubHome = () => {
  const { tokens, theme } = useTheme();
  const { isAuthenticated, signIn, user } = useAuth();
  const currentUserId = user?.id;
  const s = useMemo(() => makeStyles(tokens, theme), [tokens, theme]);

  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<HubMessage | null>(null);
  // "@ Mentions" filter: on, the stream shows only messages whose body @-mentions the signed-in
  // member (server-side filter, so old mentions beyond the loaded page are found). Mirrored in a
  // ref so the poll's stable `load` always reads the current mode.
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const mentionsOnlyRef = useRef(false);
  // Announcements filter (📣): on, the stream shows only official announcements (server-side, so old
  // ones beyond the loaded page are found) — a member with limited history can still surface them.
  // Mutually exclusive with mentions. Mirrored in a ref so the poll's stable `load` reads the mode.
  const [announcementsOnly, setAnnouncementsOnly] = useState(false);
  const announcementsOnlyRef = useRef(false);
  // The id of the first message newer than the member's last-seen marker; a single "New messages"
  // divider is drawn before it. Computed once on entry so it does not jump as new posts arrive.
  const [dividerBeforeId, setDividerBeforeId] = useState<string | null>(null);
  const seenKeys = useRef<Set<string>>(new Set());
  const dividerComputedRef = useRef(false);
  // Other members currently typing in the Commons, surfaced as "X is typing…" above the composer.
  // Only populated when the live Stream connection is up; empty in polling-only mode.
  const [typingUsers, setTypingUsers] = useState<HubTypingUser[]>([]);
  // The live Stream connection handle for the current mount (null when not connected / polling only).
  // Held in a ref so the composer's typing emitters and unmount cleanup can reach it without
  // re-rendering or re-subscribing.
  const liveConnectionRef = useRef<HubLiveConnection | null>(null);
  // Gated `#contributors` channel switch. The server filters /api/hub/channels by eligibility, so
  // the pill row renders ONLY when the response carries the contributors entry — a member without
  // it sees exactly the Commons as it ships today, with no new UI at all (the no-teaser rule).
  const [hasGatedChannel, setHasGatedChannel] = useState(false);
  const [activeChannel, setActiveChannel] = useState<'general' | typeof GATED_CHANNEL_SLUG>('general');

  // Read the channel list once per mount (signed-in only — the route requires a member). Any
  // failure resolves to the general-only view; the Commons is never blocked by this read.
  useEffect(() => {
    if (!isAuthenticated) {
      setHasGatedChannel(false);
      setActiveChannel('general');
      return;
    }
    let active = true;
    void (async () => {
      const channels = await fetchHubChannels();
      if (active) {
        setHasGatedChannel(channels.some((channel) => channel.slug === GATED_CHANNEL_SLUG));
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // A 404 from any gated channel route means access is gone: silently drop the switch and land
  // back on the Commons — no error banner, no retry loop (the no-teaser rule).
  const handleGatedUnavailable = useCallback(() => {
    setHasGatedChannel(false);
    setActiveChannel('general');
  }, []);

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

  // The active stream filter, derived from the refs. Mentions and announcements are mutually
  // exclusive; 'all' is the unfiltered blended stream.
  const currentFilter = useCallback((): HubStreamFilter => (
    mentionsOnlyRef.current ? 'mentions' : announcementsOnlyRef.current ? 'announcements' : 'all'
  ), []);

  const load = useCallback(async () => {
    setError(null);
    // Capture the mode this read was made in; a slow response that lands after the member flips
    // a filter is dropped so the filtered view is never polluted with the other mode's rows.
    const requestedFilter = currentFilter();
    try {
      const data = await fetchHubMessages(requestedFilter);
      if (currentFilter() !== requestedFilter) return;
      mergeMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the Hub.');
    } finally {
      setLoading(false);
    }
  }, [mergeMessages, currentFilter]);

  // Pull-to-refresh: re-pull messages in the background (load only shows the full-screen
  // spinner on the initial mount, so the current chat stays visible while it re-pulls).
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // A live Stream `message.new` event must always call the freshest `load` without resubscribing
  // each time the callback identity changes, so keep the latest reference in a ref.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Refresh the feed, the poll, and the best-effort live Stream layer for the life of the screen.
  // The live layer is purely additive: when POST /api/hub/join mints credentials the client opens a
  // single Stream Chat connection to the shared `ctf-feed-community` channel so new posts appear
  // immediately and members see a typing indicator. When Stream is not configured, or the connection
  // fails, the screen silently stays on the frequent poll — exactly as before. A Stream failure can
  // never break or blank the Hub.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    // Both the live path and the polling-only path keep a poll running. `intervalMs` is short when we
    // are polling-only and long when a healthy live connection is the primary refresh path.
    const startPoll = (intervalMs: number) => {
      timer = setInterval(() => {
        void loadRef.current();
      }, intervalMs);
    };

    void (async () => {
      // Load the first batch right away so the chat renders without waiting for the join handshake.
      await load();
      if (!active) return;

      // Try to open the live connection only when the server actually minted credentials. When Stream
      // is not configured (or the call fails) `fetchHubJoin` returns null and we simply poll.
      let live: HubLiveConnection | null = null;
      const credentials = await fetchHubJoin();
      if (active && credentials) {
        live = await connectHubLive(credentials, {
          // A new post (or a recovered connection) pulls fresh history right away, so posts appear
          // immediately instead of waiting for the next poll.
          onActivity: () => {
            void loadRef.current();
          },
          onTypingChange: (typing) => {
            if (active) setTypingUsers(typing);
          },
        });
      }

      if (!active) {
        // Unmounted while connecting; tear the connection down rather than leak it.
        if (live) void live.disconnect();
        return;
      }

      if (live) {
        liveConnectionRef.current = live;
        // Live connection drives refreshes; the poll becomes a slow backstop.
        startPoll(POLL_INTERVAL_LIVE_MS);
      } else {
        // Stream not configured, or the live connection failed to open: silently stay on the
        // frequent poll. The chat is fully functional this way.
        setTypingUsers([]);
        startPoll(POLL_INTERVAL_FALLBACK_MS);
      }
    })();

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      // Disconnect the live Stream client on unmount so we never leak a connection.
      const live = liveConnectionRef.current;
      liveConnectionRef.current = null;
      if (live) void live.disconnect();
    };
    // `load` is stable (it depends only on the stable mergeMessages); re-running this effect would
    // tear down and reopen the live connection, so we intentionally bind it once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear the list and re-pull in the current filter mode behind the spinner, so modes never blend
  // (the merge replaces wholesale, but a blank list avoids showing the old mode's rows mid-read).
  const reloadForFilterChange = useCallback(() => {
    setMessages([]);
    seenKeys.current = new Set();
    setLoading(true);
    void load();
  }, [load]);

  // Flip the "@ Mentions" filter. Turning it on clears the mutually-exclusive announcements filter.
  const toggleMentionsOnly = useCallback(() => {
    const next = !mentionsOnlyRef.current;
    mentionsOnlyRef.current = next;
    setMentionsOnly(next);
    if (next) {
      announcementsOnlyRef.current = false;
      setAnnouncementsOnly(false);
    }
    reloadForFilterChange();
  }, [reloadForFilterChange]);

  // Flip the announcements (📣) filter. Turning it on clears the mutually-exclusive mentions filter.
  const toggleAnnouncementsOnly = useCallback(() => {
    const next = !announcementsOnlyRef.current;
    announcementsOnlyRef.current = next;
    setAnnouncementsOnly(next);
    if (next) {
      mentionsOnlyRef.current = false;
      setMentionsOnly(false);
    }
    reloadForFilterChange();
  }, [reloadForFilterChange]);

  // Emit a typing event as the member writes in the composer. No-op when there is no live connection
  // (polling-only mode), so the composer can call it unconditionally on every keystroke.
  const notifyTyping = useCallback(() => {
    liveConnectionRef.current?.sendTyping();
  }, []);

  // Tell the channel the member has stopped typing (e.g. after sending). Best-effort; no-op when not
  // live.
  const notifyStopTyping = useCallback(() => {
    liveConnectionRef.current?.stopTyping();
  }, []);

  // Once the first batch of messages is in, read the last-seen marker, place the unread divider
  // before the first newer message, then move the marker forward. Best-effort: if the marker read
  // fails (or the member has none), no divider shows and the chat is unaffected.
  useEffect(() => {
    if (dividerComputedRef.current || loading || messages.length === 0) return;
    dividerComputedRef.current = true;
    void (async () => {
      const lastSeen = await fetchHubLastSeen();
      if (lastSeen) {
        const lastSeenMs = new Date(lastSeen).getTime();
        const firstUnseen = messages.find((m) => new Date(m.sentAtIso).getTime() > lastSeenMs);
        setDividerBeforeId(firstUnseen ? firstUnseen.id : null);
      }
      void markHubSeen();
    })();
  }, [loading, messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    // The member just sent; clear the typing indicator on the live channel right away.
    notifyStopTyping();
    try {
      const result = await sendHubMessage(text, replyTo?.communityPostId ?? null);
      setInput('');
      setReplyTo(null);
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
  }, [input, sending, replyTo, notifyStopTyping]);

  const handleToggleReaction = useCallback(
    async (message: HubMessage, emoji: HubReactionEmoji) => {
      const postId = message.communityPostId;
      if (!postId) return;
      // Optimistic: update this message's reactions immediately, then confirm with the server. On
      // failure, reload so the UI reverts to the server truth.
      setMessages((prev) => prev.map((m) => (m.id === message.id ? applyReactionToggle(m, emoji) : m)));
      try {
        await toggleHubReaction(postId, emoji);
      } catch {
        load();
      }
    },
    [load],
  );

  // Delete the member's own peer post. Confirms first (destructive, no undo — the product has no
  // edit, so this is delete-and-repost). Optimistically drops it; on failure, reload to restore.
  const handleDeletePost = useCallback(
    (message: HubMessage) => {
      const postId = message.communityPostId;
      if (!postId) return;
      Alert.alert(
        'Delete this post?',
        'This cannot be undone. To change it, delete and post again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setMessages((prev) => prev.filter((m) => m.communityPostId !== postId));
              try {
                await deleteHubMessage(postId);
              } catch {
                load();
              }
            },
          },
        ],
      );
    },
    [load],
  );

  const hubAccent = getAppAccent('chyme', theme);
  // "X is typing…" line, present only while the live connection is up and others are typing.
  const typingLabel = formatTypingLabel(typingUsers);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarText}>SH</Text>
        </View>
        <View style={s.headerMeta}>
          <Text style={s.headerTitle}>Survivor Hub</Text>
          <Text style={s.headerSub}>Community · Live</Text>
        </View>
        {/* Mentions filter — signed-in only (the handles are derived from the member). Icon-only "@"
            chip (the word was dropped to match the 📣 chip); filled while the filter is on. */}
        {isAuthenticated && (
          <Pressable
            style={[s.mentionsToggle, mentionsOnly ? s.mentionsToggleActive : null]}
            onPress={toggleMentionsOnly}
            accessibilityRole="button"
            accessibilityState={{ selected: mentionsOnly }}
            accessibilityLabel={mentionsOnly ? 'Show all messages' : 'Show only messages that mention you'}
          >
            <Text style={[s.mentionsToggleText, mentionsOnly ? s.mentionsToggleTextActive : null]}>@</Text>
          </Pressable>
        )}
        {/* Announcements filter — emoji-only chip (the word is too long). Lets a member with limited
            history surface official announcements that scrolled off the recent page. */}
        {isAuthenticated && (
          <Pressable
            style={[s.announcementsToggle, announcementsOnly ? s.announcementsToggleActive : null]}
            onPress={toggleAnnouncementsOnly}
            accessibilityRole="button"
            accessibilityState={{ selected: announcementsOnly }}
            accessibilityLabel={announcementsOnly ? 'Show all messages' : 'Show only announcements'}
          >
            <Text style={s.announcementsToggleText}>📣</Text>
          </Pressable>
        )}
      </View>

      {/* Channel switch pills — rendered ONLY when the server-filtered channel list carries the
          gated contributors entry (mirrors the web phone-width pill row: with one channel, no
          switch row exists at all). */}
      {hasGatedChannel && (
        <View style={s.channelSwitchRow}>
          <Pressable
            style={[s.channelPill, activeChannel === 'general' ? s.channelPillActive : null]}
            onPress={() => setActiveChannel('general')}
            accessibilityRole="button"
            accessibilityState={{ selected: activeChannel === 'general' }}
          >
            <Text style={[s.channelPillText, activeChannel === 'general' ? s.channelPillTextActive : null]}>
              #general
            </Text>
          </Pressable>
          <Pressable
            style={[s.channelPill, activeChannel === GATED_CHANNEL_SLUG ? s.channelPillActive : null]}
            onPress={() => setActiveChannel(GATED_CHANNEL_SLUG)}
            accessibilityRole="button"
            accessibilityState={{ selected: activeChannel === GATED_CHANNEL_SLUG }}
          >
            <Text style={[s.channelPillText, activeChannel === GATED_CHANNEL_SLUG ? s.channelPillTextActive : null]}>
              {GATED_CHANNEL_DISPLAY_NAME}
            </Text>
          </Pressable>
        </View>
      )}

      {activeChannel === GATED_CHANNEL_SLUG ? (
        <GatedChannel onUnavailable={handleGatedUnavailable} />
      ) : (
        <>
      {/* Early-Commons treatment members land here without passing the Unlock screen, so prompt them to
          verify (submit their Quora URL) right here. Self-hides for control / verified members. */}
      {isAuthenticated ? <UnlockVerifyBanner /> : null}

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
        <EmptyState s={s} mentionsOnly={mentionsOnly} announcementsOnly={announcementsOnly} mentionLabel={mentionLabelFor(user?.username, currentUserId)} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <>
              {item.id === dividerBeforeId && (
                <View style={s.unreadDivider}>
                  <View style={s.unreadDividerLine} />
                  <Text style={s.unreadDividerText}>New messages</Text>
                  <View style={s.unreadDividerLine} />
                </View>
              )}
              <MessageCard
                message={item}
                s={s}
                tokens={tokens}
                theme={theme}
                canReact={isAuthenticated}
                onToggleReaction={handleToggleReaction}
                canReply={isAuthenticated}
                onReply={setReplyTo}
                onDelete={handleDeletePost}
                currentUserId={currentUserId}
              />
            </>
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={hubAccent} />}
        />
      )}

      {typingLabel && (
        <View style={s.typingRow}>
          <Text style={s.typingText} numberOfLines={1}>
            {typingLabel}
          </Text>
        </View>
      )}

      {isAuthenticated ? (
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
                  {replyTo.text}
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
          <View style={s.composer}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={(text) => {
                setInput(text);
                // Best-effort live typing event; a no-op in polling-only mode.
                notifyTyping();
              }}
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
      ) : (
        // Signed-out visitors can read the general channel but must sign in to post,
        // matching the web Hub's locked composer. The general channel is where a
        // signed-in member posts to ask for help, so the door to it is sign-in.
        <View style={s.lockedComposer}>
          <Text style={s.lockedLock} accessibilityElementsHidden>🔒</Text>
          <Text style={s.lockedText}>Sign in to post in the general channel.</Text>
          <Pressable style={s.signInBtn} onPress={() => signIn()} accessibilityRole="button">
            <Text style={s.signInBtnText}>Sign in</Text>
          </Pressable>
        </View>
      )}
        </>
      )}
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
    headerMeta: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary, letterSpacing: t.isComic ? 0.6 : 0, textTransform: t.isComic ? 'uppercase' : 'none' },
    headerSub: { fontSize: 11, color: t.success },
    // Mentions filter pill in the header — icon-only "@" chip, same compact size as the 📣 pill.
    mentionsToggle: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: t.radiusChip,
      backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: t.isComic ? `${t.border}40` : 'rgba(255,255,255,0.1)',
    },
    mentionsToggleActive: {
      backgroundColor: `${t.success}1F`,
      borderColor: `${t.success}66`,
    },
    mentionsToggleText: { fontSize: 15, fontWeight: '800', lineHeight: 16, color: t.textSecondary },
    mentionsToggleTextActive: { color: t.success },
    // Announcements filter pill (📣). "Announcements" is too long for a chip, so it shows the emoji
    // alone; the active state uses the official-announcement accent so its purpose reads at a glance.
    announcementsToggle: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: t.radiusChip,
      backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: t.isComic ? `${t.border}40` : 'rgba(255,255,255,0.1)',
    },
    announcementsToggleActive: {
      backgroundColor: `${official}1F`,
      borderColor: `${official}66`,
    },
    announcementsToggleText: { fontSize: 13, lineHeight: 16 },
    // Channel switch pill row (present only when the gated contributors channel is listed for
    // this member). Mirrors the web phone-width channel pills.
    channelSwitchRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: t.isComic ? 2 : 1,
      borderBottomColor: t.isComic ? t.border : t.borderFaint,
    },
    channelPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: t.radiusChip,
      backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: t.isComic ? `${t.border}40` : 'rgba(255,255,255,0.1)',
    },
    channelPillActive: {
      backgroundColor: `${t.success}1F`,
      borderColor: `${t.success}66`,
    },
    channelPillText: { fontSize: 12, fontWeight: '700', color: t.textSecondary },
    channelPillTextActive: { color: t.success },
    list: { padding: 16, gap: 10 },
    card: { borderRadius: r, borderWidth: t.isComic ? 1.5 : 1, padding: 14, marginBottom: 10 },
    cardOfficial: { backgroundColor: t.isComic ? `${official}10` : 'rgba(124,58,237,0.07)', borderColor: t.isComic ? `${official}50` : 'rgba(124,58,237,0.22)' },
    // Others' community posts use the hub/community color; the member's own use a neutral gray.
    cardCommunity: { backgroundColor: `${t.success}12`, borderColor: `${t.success}30` },
    cardCommunityOwn: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    avatar: { width: 28, height: 28, borderRadius: t.isComic ? 0 : 8, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 11, fontWeight: '800' },
    cardMeta: { flex: 1 },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardName: { fontSize: 13, fontWeight: '700', color: t.textPrimary, letterSpacing: t.isComic ? 0.4 : 0 },
    officialBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: t.radiusChip, backgroundColor: t.isComic ? 'transparent' : 'rgba(124,58,237,0.2)', borderWidth: t.isComic ? 1 : 0, borderColor: `${t.border}40` },
    officialBadgeText: { fontSize: 10, fontWeight: t.isComic ? '700' : '600', color: t.isComic ? t.border : '#A78BFA', letterSpacing: t.isComic ? 0.6 : 0, textTransform: t.isComic ? 'uppercase' : 'none' },
    cardTime: { fontSize: 11, color: t.textSecondary, marginTop: 1 },
    cardTitle: { fontSize: 14, fontWeight: '700', color: t.textPrimary, lineHeight: 20, marginBottom: 3 },
    cardBody: { fontSize: 13, color: t.isComic ? t.textPrimary : '#D1D5DB', lineHeight: 21 },
    linkedPluginChip: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: t.isComic ? 'transparent' : 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: t.isComic ? `${t.border}66` : 'rgba(52,211,153,0.4)' },
    linkedPluginChipText: { fontSize: 13, fontWeight: '600', color: t.isComic ? t.textPrimary : '#34D399' },
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
    replyBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radiusChip,
    },
    replyBtnText: { fontSize: 11, fontWeight: '700', color: t.textSecondary },
    deleteBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radiusChip,
    },
    deleteBtnText: { fontSize: 11, fontWeight: '700', color: t.isComic ? t.textSecondary : '#F87171' },
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
    unreadDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    unreadDividerLine: { flex: 1, height: 1, backgroundColor: `${t.danger}55` },
    unreadDividerText: {
      fontSize: 11,
      fontWeight: '700',
      color: t.danger,
      letterSpacing: t.isComic ? 0.6 : 0.3,
      textTransform: 'uppercase',
    },
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
    typingRow: { paddingHorizontal: 16, paddingVertical: 4 },
    typingText: { fontSize: 12, fontStyle: 'italic', color: t.textSecondary },
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
    lockedComposer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: t.surfaceAlt,
      borderTopWidth: t.isComic ? 2 : 1,
      borderTopColor: t.isComic ? t.border : t.borderFaint,
    },
    lockedLock: { fontSize: 15 },
    lockedText: { flex: 1, fontSize: 13, color: t.textSecondary },
    signInBtn: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: r,
      backgroundColor: t.isComic ? t.border : official,
      borderWidth: t.isComic ? 1.5 : 0,
      borderColor: t.border,
    },
    signInBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: t.isComic ? t.bg : '#fff',
      letterSpacing: t.isComic ? 0.4 : 0,
      textTransform: t.isComic ? 'uppercase' : 'none',
    },
  });
}
