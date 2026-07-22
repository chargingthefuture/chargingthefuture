'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HubJoinResponse, HubLastSeenResponse, HubMessage, HubMessagesResponse } from '../../lib/hub/types';
import { connectHubLive, type HubLiveConnection, type HubTypingUser } from '../../lib/hub/live-stream';
import { resolveConcierge, conciergeStarterPrompts } from '../../lib/concierge/resolver';
import type { ChatMessage, ChatQuotedMessage, ChatReactionSummary, ComicAnswerRating, ComicLinkedPlugin, ComicStreamItem, ShellCurrentUser } from './shell-types';
import { FEED_REACTION_EMOJIS } from '../../lib/feed/constants';

// Poll cadence: the 10s poll is the only refresh path when the live Stream connection is absent or
// degraded. When the live connection is healthy, real-time events drive refreshes and the poll is a
// slow backstop only, so it runs far less often to cut request volume.
const POLL_INTERVAL_FALLBACK_MS = 10_000;
const POLL_INTERVAL_LIVE_MS = 30_000;

// The peer message the composer is currently replying to (Signal-style quote). Carries the
// quoted post's id (the reply target) plus a quote preview for the composer banner.
export type ReplyTarget = {
  postId: string;
  quote: ChatQuotedMessage;
};

type ChatConnectionState = 'loading' | 'live' | 'fallback';

// localStorage key for the one-time AI-processing consent (the llm_consent_granted gate the
// backend expects). Scoped per user so a shared browser does not leak consent between accounts.
const COMIC_CONSENT_STORAGE_PREFIX = 'ctf.comic.consentGranted';

// A message routes to the AI Assistant only when it mentions `@comic` (word-boundary, case
// insensitive — must match the server-side COMIC_MENTION_REGEX). No mention → peer-to-peer post.
const COMIC_MENTION_REGEX = /(^|\s)@comic\b/i;

function mentionsComic(text: string): boolean {
  return COMIC_MENTION_REGEX.test(text);
}

function stripComicMention(text: string): string {
  return text.replace(COMIC_MENTION_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

function consentStorageKey(userId: string): string {
  return `${COMIC_CONSENT_STORAGE_PREFIX}.${userId}`;
}

function formatTimeLabel(value: string | Date | null | undefined): string {
  if (!value) return 'Now';

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return 'Now';
  }

  // Full, unambiguous timestamp for a global audience: month spelled out, date, year, time, and the
  // viewer's timezone — e.g. "June 21, 2026, 7:44 AM EDT". Built in two parts so the date and time are
  // always joined by a comma (avoids the locale "at" separator).
  const datePart = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
  return `${datePart}, ${timePart}`;
}

// Build the base ChatMessage for a stored (server) message. It deliberately attaches NO "Open X"
// action button: a peer community post must never carry a plugin link the author did not add, and
// members cannot attach one. (The old keyword inference here wrongly decorated any post containing
// words like "economy"/"housing" with an "Open GDP"/"Open LightHouse" button, making it look as if
// the poster had linked a plugin.) Action buttons come only from an explicit source — the local
// concierge reply sets its own actionLabel/actionSlug — never from message text.
function buildChatMessage(
  id: string,
  from: 'hub' | 'user',
  text: string,
  time: string,
  senderLabel?: string,
): ChatMessage {
  return {
    id,
    from,
    text,
    time,
    senderLabel,
  };
}

function mapStoredMessage(message: HubMessage, currentUserId: string): ChatMessage {
  const from = message.userId === currentUserId ? 'user' : 'hub';
  return {
    ...buildChatMessage(
      message.id,
      from,
      message.text,
      formatTimeLabel(message.sentAtIso),
      message.displayName,
    ),
    sentAtIso: message.sentAtIso,
    kind: message.kind,
    announcementTitle: message.title,
    linkedPlugins: message.linkedPlugins ?? [],
    communityPostId: message.communityPostId,
    announcementId: message.announcementId,
    quotedMessage: message.quotedMessage,
    reactions: message.reactions ?? [],
    replyCount: message.replyCount,
  };
}

// Order reaction summaries by the fixed reaction set so chips stay in a stable order after an
// optimistic add inserts a new emoji.
function orderReactionsByFixedSet(reactions: ChatReactionSummary[]): ChatReactionSummary[] {
  const rank = new Map<string, number>(FEED_REACTION_EMOJIS.map((emoji, index) => [emoji, index]));
  return [...reactions].sort((a, b) => (rank.get(a.emoji) ?? 999) - (rank.get(b.emoji) ?? 999));
}

// Flip the current member's reaction for one emoji on one message, adjusting count and the
// reactedByMe flag. Used for the optimistic update before the server confirms and the 10s poll
// reconciles. Removing the last reaction of an emoji drops its chip entirely.
function applyReactionToggle(message: ChatMessage, emoji: string): ChatMessage {
  const reactions = message.reactions ?? [];
  const existing = reactions.find((reaction) => reaction.emoji === emoji);

  if (existing) {
    const nextCount = existing.reactedByMe ? existing.count - 1 : existing.count + 1;
    const nextReactedByMe = !existing.reactedByMe;
    const next = nextCount <= 0
      ? reactions.filter((reaction) => reaction.emoji !== emoji)
      : reactions.map((reaction) =>
        reaction.emoji === emoji
          ? { emoji, count: nextCount, reactedByMe: nextReactedByMe }
          : reaction,
      );
    return { ...message, reactions: orderReactionsByFixedSet(next) };
  }

  const next = [...reactions, { emoji, count: 1, reactedByMe: true }];
  return { ...message, reactions: orderReactionsByFixedSet(next) };
}

function getMessageDedupKey(message: ChatMessage): string {
  // A peer post is the same post wherever it arrived from: the POST /api/hub/messages response
  // carries the post id with its created time, while the GET list carries the timeline item id
  // with its published time. Keying on the stable community post id keeps those two copies from
  // rendering as a temporary duplicate whenever their timestamps straddle a minute boundary (the
  // composite key below folds the formatted time label in, so "9:32 PM" vs "9:33 PM" defeated
  // it). Non-post lines (AI answers, concierge, announcement rows) keep the composite key.
  if (message.communityPostId) {
    return `post|${message.communityPostId}`;
  }
  return [message.from, message.senderLabel ?? '', message.text.trim().toLowerCase(), message.time].join('|');
}

function mergeMessages(existing: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const merged = [...existing];
  const seen = new Set(existing.map(getMessageDedupKey));

  for (const message of next) {
    const key = getMessageDedupKey(message);
    if (seen.has(key)) {
      continue;
    }

    merged.push(message);
    seen.add(key);
  }

  return merged;
}

function normalizeQuestion(value: string): string {
  return value.trim().toLowerCase();
}

// Merge the server comic stream over the local one. Optimistic placeholders are dropped only as the
// server catches up, COUNT-aware per normalized question text: if the asker sent the same question
// twice (two optimistic cards) and the server now reports one, exactly one optimistic card is
// retained. A plain text-membership check dropped all duplicates as soon as the first landed.
function mergeComicItems(serverItems: ComicStreamItem[], optimistic: ComicStreamItem[]): ComicStreamItem[] {
  const serverCounts = new Map<string, number>();
  for (const item of serverItems) {
    const key = normalizeQuestion(item.question);
    serverCounts.set(key, (serverCounts.get(key) ?? 0) + 1);
  }

  // Newest optimistic cards retire first against each matching server item; the remainder survive.
  const remainingToRetire = new Map(serverCounts);
  const survivingOptimistic: ComicStreamItem[] = [];
  for (let i = optimistic.length - 1; i >= 0; i -= 1) {
    const item = optimistic[i];
    if (!item.optimistic) {
      continue;
    }
    const key = normalizeQuestion(item.question);
    const retireCount = remainingToRetire.get(key) ?? 0;
    if (retireCount > 0) {
      remainingToRetire.set(key, retireCount - 1);
      continue;
    }
    survivingOptimistic.unshift(item);
  }

  return [...serverItems, ...survivingOptimistic];
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
  });

  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? payload.message
      : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }

  return payload as T;
}

type ComicConversationResponse = {
  ok: true;
  items: Array<{
    questionTurnId: string;
    conversationId: string;
    status: 'pending' | 'answered';
    question: string;
    answer: string | null;
    answerTurnId: string | null;
    currentUserRating: ComicAnswerRating | null;
    linkedPlugins: ComicLinkedPlugin[];
    askedAtIso: string;
  }>;
};

type ComicMessageResponse = {
  ok: true;
  routedToAssistant: boolean;
  status?: 'review_pending' | 'human_first';
  conversationId?: string;
  holdingResponse?: string;
};

export function useHomeChat(currentUser: ShellCurrentUser) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [comicItems, setComicItems] = useState<ComicStreamItem[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ChatConnectionState>('loading');
  const [isSending, setIsSending] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  // The question text held while the first-use consent modal is open. Confirming sends it.
  const [pendingConsentText, setPendingConsentText] = useState<string | null>(null);
  // The peer message the composer is replying to (Signal-style quote), or null when none.
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  // The member's last-seen marker for the Hub channel, used to place the "New messages"
  // divider. Read once on entry; null means "show everything as new" / not yet loaded.
  const [lastSeenAtIso, setLastSeenAtIso] = useState<string | null>(null);
  // Guards so we mark "seen" at most once per mount and never push the marker backwards.
  const markedSeenRef = useRef(false);
  // Other members currently typing in the Commons, surfaced as "X is typing…" above the composer.
  // Only populated when the live Stream connection is up; empty in polling-only mode.
  const [typingUsers, setTypingUsers] = useState<HubTypingUser[]>([]);
  // The live Stream connection handle for the current mount (null when not connected / polling only).
  // Held in a ref so the composer's typing emitters and unmount cleanup can reach it without
  // re-rendering or re-subscribing.
  const liveConnectionRef = useRef<HubLiveConnection | null>(null);
  // "@ Mentions" filter: when on, history reads add `mentions=me` so the server returns only
  // peer messages whose body @-mentions the viewer (server-derived handles, searched beyond the
  // loaded page). Mirrored in a ref so refreshHistory (and the poll/live handlers that hold an
  // older callback identity) always read the current mode without re-bootstrapping the chat.
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const mentionsOnlyRef = useRef(false);
  // "Announcements" filter (📣 chip): when on, history reads add `channel=announcements` so the
  // server returns only official announcements — including ones that scrolled off the recent page,
  // so a member with limited history can still surface them. Mutually exclusive with mentions.
  const [announcementsOnly, setAnnouncementsOnly] = useState(false);
  const announcementsOnlyRef = useRef(false);
  // True while the stream is being re-fetched right after a filter flip, so the panel can
  // show a loading line instead of a premature empty state.
  const [isFilterRefreshing, setIsFilterRefreshing] = useState(false);

  // Whether the composer currently contains an @comic mention — used to show the mention chip
  // affordance live as the asker types.
  const composerMentionsComic = useMemo(() => mentionsComic(input), [input]);

  // The active stream filter, derived from the refs so the poll/live handlers (which hold older
  // callback identities) always read the current mode. Mentions and announcements are mutually
  // exclusive; 'all' is the unfiltered blended stream.
  const currentFilterKey = (): 'mentions' | 'announcements' | 'all' =>
    mentionsOnlyRef.current ? 'mentions' : announcementsOnlyRef.current ? 'announcements' : 'all';

  const refreshHistory = useCallback(async () => {
    const filterKey = currentFilterKey();
    const filterParam =
      filterKey === 'mentions' ? '&mentions=me' : filterKey === 'announcements' ? '&channel=announcements' : '';
    const payload = await requestJson<HubMessagesResponse>(`/api/hub/messages?limit=50${filterParam}`);
    // Ignore a response that raced a mode flip (e.g. a slow read landing after the member changed
    // the filter) so the filtered view never gets polluted with the wrong stream.
    if (currentFilterKey() !== filterKey) {
      return;
    }
    const nextMessages = payload.messages.map((message) => mapStoredMessage(message, currentUser.userId));
    setMessages((previous) => mergeMessages(previous, nextMessages));
  }, [currentUser.userId]);

  // Deep-link "load around": pull a page centered on a specific message/announcement from the server
  // and merge it in, so a target older than the recent page is present for the stream to scroll to.
  // Best-effort and additive — the recent page still loads alongside, so the member sees both the old
  // message and current activity. Only applies to the unfiltered stream (a deep link is not a
  // mentions/announcements view), so it no-ops while a filter is active.
  const loadAround = useCallback(async (postId: string | null, announcementId: string | null) => {
    const aroundParam = postId
      ? `&aroundPost=${encodeURIComponent(postId)}`
      : announcementId
        ? `&aroundAnnouncement=${encodeURIComponent(announcementId)}`
        : '';
    if (!aroundParam || currentFilterKey() !== 'all') return;
    const payload = await requestJson<HubMessagesResponse>(`/api/hub/messages?limit=50${aroundParam}`);
    if (currentFilterKey() !== 'all') return;
    const nextMessages = payload.messages.map((message) => mapStoredMessage(message, currentUser.userId));
    setMessages((previous) => mergeMessages(previous, nextMessages));
    // currentFilterKey reads refs, so it is intentionally not a dependency.
  }, [currentUser.userId]);

  // Bootstrap variant: read the deep link from the entry URL once on cold load and pull its window.
  const loadAroundDeepLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    await loadAround(params.get('post'), params.get('announcement'));
  }, [loadAround]);

  // The live Stream event handler must always call the freshest refreshHistory without resubscribing
  // each time the callback identity changes, so keep the latest reference in a ref.
  const refreshHistoryRef = useRef(refreshHistory);
  useEffect(() => {
    refreshHistoryRef.current = refreshHistory;
  }, [refreshHistory]);

  const refreshComic = useCallback(async () => {
    const payload = await requestJson<ComicConversationResponse>('/api/comic/conversation?limit=30');
    const serverItems: ComicStreamItem[] = payload.items.map((item) => ({ ...item }));
    setComicItems((previous) => mergeComicItems(serverItems, previous));
  }, []);

  // Read the member's last-seen marker once on entry so the chat can place the "New messages"
  // divider. Best-effort: a failure leaves the marker null (everything reads as already seen,
  // i.e. no divider) and never blocks the chat.
  const refreshLastSeen = useCallback(async () => {
    try {
      const payload = await requestJson<HubLastSeenResponse>('/api/hub/last-seen');
      setLastSeenAtIso(payload.lastSeenAtIso);
    } catch {
      setLastSeenAtIso(null);
    }
  }, []);

  // Move the last-seen marker to now after the member has viewed the chat. Best-effort and at
  // most once per mount; a failure is swallowed so it can never break the chat.
  const markSeen = useCallback(() => {
    if (markedSeenRef.current) return;
    markedSeenRef.current = true;
    void (async () => {
      try {
        await requestJson<HubLastSeenResponse>('/api/hub/last-seen', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-ctf-csrf': '1',
          },
          body: JSON.stringify({ seenAtIso: new Date().toISOString() }),
        });
      } catch {
        // Best-effort: leave markedSeenRef set so a transient failure does not retry-spam.
      }
    })();
  }, []);

  // Clear the loaded messages and re-fetch in the current filter mode. The list is cleared first so
  // modes never blend (merge is additive, so a shared list would keep old rows around).
  const refreshForFilterChange = useCallback(() => {
    setMessages([]);
    setIsFilterRefreshing(true);
    void refreshHistory()
      .catch(() => {
        // Best-effort: the poll retries shortly; the empty state covers the gap.
      })
      .finally(() => setIsFilterRefreshing(false));
  }, [refreshHistory]);

  // Flip the "@ Mentions" filter. Turning it on clears the mutually-exclusive announcements filter.
  const toggleMentionsOnly = useCallback(() => {
    const next = !mentionsOnlyRef.current;
    mentionsOnlyRef.current = next;
    setMentionsOnly(next);
    if (next) {
      announcementsOnlyRef.current = false;
      setAnnouncementsOnly(false);
    }
    refreshForFilterChange();
  }, [refreshForFilterChange]);

  // Flip the announcements (📣) filter. Turning it on clears the mutually-exclusive mentions filter.
  const toggleAnnouncementsOnly = useCallback(() => {
    const next = !announcementsOnlyRef.current;
    announcementsOnlyRef.current = next;
    setAnnouncementsOnly(next);
    if (next) {
      mentionsOnlyRef.current = false;
      setMentionsOnly(false);
    }
    refreshForFilterChange();
  }, [refreshForFilterChange]);

  // Force the unfiltered blended stream (used when a deep link must land but a filter is active). Clears
  // both filters and re-fetches; a no-op when neither filter is on.
  const showAllStream = useCallback(() => {
    if (!mentionsOnlyRef.current && !announcementsOnlyRef.current) return;
    mentionsOnlyRef.current = false;
    announcementsOnlyRef.current = false;
    setMentionsOnly(false);
    setAnnouncementsOnly(false);
    refreshForFilterChange();
  }, [refreshForFilterChange]);

  // Emit a typing event as the member writes in the composer. No-op when there is no live
  // connection (polling-only mode), so the composer can call it unconditionally on every keystroke.
  const notifyTyping = useCallback(() => {
    liveConnectionRef.current?.sendTyping();
  }, []);

  // Tell the channel the member has stopped typing (e.g. after sending). Best-effort; no-op when not
  // live.
  const notifyStopTyping = useCallback(() => {
    liveConnectionRef.current?.stopTyping();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setConsentGranted(window.localStorage.getItem(consentStorageKey(currentUser.userId)) === '1');
  }, [currentUser.userId]);

  useEffect(() => {
    let active = true;
    let pollId: number | undefined;

    setConnectionState('loading');
    setError(null);
    setMessages([]);
    setComicItems([]);
    // Reset per-mount "seen" state so re-entering the chat reads the marker afresh and can
    // mark seen once more.
    markedSeenRef.current = false;
    setLastSeenAtIso(null);

    async function bootstrapChat() {
      // Read the last-seen marker before history settles so the divider can be placed on the
      // first render of the stream. Best-effort; failure leaves it null (no divider).
      void refreshLastSeen();
      try {
        await Promise.all([refreshHistory(), refreshComic().catch(() => undefined)]);
        // After the recent page loads, pull the deep-link target's window (if any) and merge it in.
        void loadAroundDeepLink().catch(() => undefined);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load live chat history.');
        }
      }

      // Both the live path and the polling-only path keep a poll running. `intervalMs` is short when
      // we are polling-only and long when a healthy live connection is the primary refresh path.
      const startPoll = (intervalMs: number) => {
        pollId = window.setInterval(() => {
          void refreshHistory().catch(() => {
            // Keep polling while the shell is mounted.
          });
          void refreshComic().catch(() => {
            // The comic stream poll is best-effort; failures must not break hub polling.
          });
        }, intervalMs);
      };

      try {
        const join = await requestJson<HubJoinResponse>('/api/hub/join', { method: 'POST' });
        if (!active) return;
        setConnectionState('live');
        setError(null);

        // Try to open the live Stream connection only when the server actually minted credentials.
        // When Stream is not configured (configured: false) we never attempt a connection and simply
        // poll — Commons must keep working without Stream.
        let live: HubLiveConnection | null = null;
        if (join.configured) {
          live = await connectHubLive(
            {
              streamApiKey: join.streamApiKey,
              streamToken: join.streamToken,
              streamUserId: join.streamUserId,
              streamChannelId: join.streamChannelId,
            },
            {
              // A new post (or a recovered connection) pulls fresh history right away, so posts appear
              // immediately instead of waiting for the next poll.
              onActivity: () => {
                void refreshHistoryRef.current().catch(() => undefined);
              },
              onTypingChange: (typing) => {
                if (active) setTypingUsers(typing);
              },
            },
          );
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
      } catch (joinError) {
        if (!active) return;

        setConnectionState('fallback');
        setError(joinError instanceof Error ? joinError.message : 'Live chat is reconnecting.');
        startPoll(POLL_INTERVAL_FALLBACK_MS);
      }
    }

    void bootstrapChat();

    return () => {
      active = false;
      if (pollId) {
        window.clearInterval(pollId);
      }
      // Disconnect the live Stream client on unmount so we never leak a connection.
      const live = liveConnectionRef.current;
      liveConnectionRef.current = null;
      if (live) {
        void live.disconnect();
      }
    };
  }, [currentUser.displayName, currentUser.userId, refreshHistory, refreshComic, refreshLastSeen, loadAroundDeepLink]);

  // Route an @comic question to the assistant. The server returns ONLY a holding response (202) —
  // never the unreviewed draft — so we optimistically render the pending "Reviewing for safety"
  // card and rely on the polling stream to surface the answer once a human approves it.
  const routeToComic = useCallback(
    async (questionText: string) => {
      const question = stripComicMention(questionText);
      // Unique per ask (random suffix) so two rapid identical-text asks get distinct React keys and
      // are tracked independently by the count-aware merge.
      const localId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticItem: ComicStreamItem = {
        questionTurnId: localId,
        conversationId: 'optimistic',
        status: 'pending',
        question,
        answer: null,
        answerTurnId: null,
        currentUserRating: null,
        linkedPlugins: [],
        askedAtIso: new Date().toISOString(),
        optimistic: true,
      };
      setComicItems((previous) => [...previous, optimisticItem]);

      try {
        await requestJson<ComicMessageResponse>('/api/comic/message', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-ctf-csrf': '1',
          },
          body: JSON.stringify({ body: questionText, channel: 'hub', consentGranted: true }),
        });
        // Pull the server stream so the pending card reflects the persisted turn.
        await refreshComic().catch(() => undefined);
      } catch (sendError) {
        // Drop the optimistic card on failure and surface the error.
        setComicItems((previous) => previous.filter((item) => item.questionTurnId !== optimisticItem.questionTurnId));
        setError(sendError instanceof Error ? sendError.message : 'Unable to reach the AI Assistant right now.');
      }
    },
    [refreshComic],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) {
      return;
    }

    // @comic mention → AI Assistant. Gate the first use behind the consent modal.
    if (mentionsComic(text)) {
      if (!consentGranted) {
        setPendingConsentText(text);
        setConsentModalOpen(true);
        return;
      }

      setIsSending(true);
      setError(null);
      setInput('');
      try {
        await routeToComic(text);
      } finally {
        setIsSending(false);
      }
      return;
    }

    // No mention → peer-to-peer community post via the existing hub path. Capture the active
    // reply target (Signal-style quote) before clearing it, and send its post id + the quote
    // the sender saw so the server stores the reference and the optimistic copy renders it.
    const activeReply = replyTarget;
    setIsSending(true);
    setError(null);
    setInput('');
    setReplyTarget(null);
    // The member just sent; clear the typing indicator on the live channel right away.
    notifyStopTyping();

    try {
      const payload = await requestJson<{ ok: true; message: HubMessage }>('/api/hub/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ctf-csrf': '1',
        },
        body: JSON.stringify(
          activeReply
            ? { text, replyToPostId: activeReply.postId, quotedMessage: activeReply.quote }
            : { text },
        ),
      });
      const savedMessage = mapStoredMessage(payload.message, currentUser.userId);
      setMessages((previous) => mergeMessages(previous, [savedMessage]));
    } catch (sendError) {
      // Restore the reply target so the member can retry the reply.
      if (activeReply) {
        setReplyTarget(activeReply);
      }
      setError(sendError instanceof Error ? sendError.message : 'Unable to send your message right now.');
    } finally {
      setIsSending(false);
    }
  }, [consentGranted, currentUser.userId, input, isSending, notifyStopTyping, replyTarget, routeToComic]);

  // Begin a Signal-style reply to a peer message: set the composer's "replying to …" state.
  // Only peer posts carry a communityPostId, so AI answers / concierge lines cannot be replied to.
  const beginReply = useCallback((message: ChatMessage) => {
    if (!message.communityPostId) return;
    const author = message.senderLabel ?? 'Community member';
    const snippet = message.text.trim().slice(0, 120);
    setReplyTarget({ postId: message.communityPostId, quote: { author, snippet, postId: message.communityPostId } });
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  // Toggle the current member's emoji reaction on a peer post. Optimistically flips the chip
  // (count + reactedByMe) right away, then POSTs; on failure the optimistic change is reverted.
  // The 10s history poll reconciles to the authoritative server aggregate.
  const toggleReaction = useCallback(
    async (postId: string, emoji: string) => {
      // Optimistically flip every message backed by this community post.
      setMessages((previous) =>
        previous.map((message) =>
          message.communityPostId === postId ? applyReactionToggle(message, emoji) : message,
        ),
      );

      try {
        await requestJson<{ ok: true; reacted: boolean }>(
          `/api/hub/messages/${encodeURIComponent(postId)}/reactions`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-ctf-csrf': '1',
            },
            body: JSON.stringify({ emoji }),
          },
        );
      } catch (reactError) {
        // Revert the optimistic flip (toggling the same emoji again undoes it).
        setMessages((previous) =>
          previous.map((message) =>
            message.communityPostId === postId ? applyReactionToggle(message, emoji) : message,
          ),
        );
        setError(reactError instanceof Error ? reactError.message : 'Unable to update your reaction right now.');
      }
    },
    [],
  );

  // Toggle the current member's emoji reaction on an official announcement. Mirrors toggleReaction
  // but keyed on the announcement id: optimistically flips the chip on every message backed by this
  // announcement, then POSTs; on failure the optimistic change is reverted. The next fresh history
  // load reconciles to the authoritative server aggregate.
  const toggleAnnouncementReaction = useCallback(
    async (announcementId: string, emoji: string) => {
      setMessages((previous) =>
        previous.map((message) =>
          message.announcementId === announcementId ? applyReactionToggle(message, emoji) : message,
        ),
      );

      try {
        await requestJson<{ ok: true; reacted: boolean }>(
          `/api/announcements/${encodeURIComponent(announcementId)}/reactions`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-ctf-csrf': '1',
            },
            body: JSON.stringify({ emoji }),
          },
        );
      } catch (reactError) {
        // Revert the optimistic flip (toggling the same emoji again undoes it).
        setMessages((previous) =>
          previous.map((message) =>
            message.announcementId === announcementId ? applyReactionToggle(message, emoji) : message,
          ),
        );
        setError(reactError instanceof Error ? reactError.message : 'Unable to update your reaction right now.');
      }
    },
    [],
  );

  // Delete one of the member's own peer posts. The product has no edit — to change a post you
  // delete and repost — so this removes the post outright. Optimistically drops it from the stream,
  // then DELETEs; on failure the post is restored and an error is shown. Server enforces author-only.
  const deleteMessage = useCallback(
    async (postId: string) => {
      let removed: ChatMessage[] = [];
      setMessages((previous) => {
        removed = previous.filter((message) => message.communityPostId === postId);
        return previous.filter((message) => message.communityPostId !== postId);
      });

      try {
        await requestJson<{ ok: true; postId: string }>(
          `/api/hub/messages/${encodeURIComponent(postId)}`,
          {
            method: 'DELETE',
            headers: { 'x-ctf-csrf': '1' },
          },
        );
      } catch (deleteError) {
        // Restore the optimistically removed post(s) and surface the error.
        if (removed.length > 0) {
          setMessages((previous) => mergeMessages(previous, removed));
        }
        setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete your post right now.');
      }
    },
    [],
  );

  // Consent modal "Confirm": persist consent and send the held @comic question.
  const confirmConsent = useCallback(async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(consentStorageKey(currentUser.userId), '1');
    }
    setConsentGranted(true);
    setConsentModalOpen(false);

    const held = pendingConsentText;
    setPendingConsentText(null);
    if (!held) return;

    setIsSending(true);
    setError(null);
    setInput('');
    try {
      await routeToComic(held);
    } finally {
      setIsSending(false);
    }
  }, [currentUser.userId, pendingConsentText, routeToComic]);

  // Consent modal "Not now": do not route; keep the question in the composer so the asker can edit
  // or send it as a normal post.
  const dismissConsent = useCallback(() => {
    setConsentModalOpen(false);
    if (pendingConsentText) {
      setInput(pendingConsentText);
    }
    setPendingConsentText(null);
  }, [pendingConsentText]);

  // Rate an answered AI Assistant card. Optimistically reflects the choice; reverts on failure.
  const rateComicAnswer = useCallback(
    async (turnId: string, rating: ComicAnswerRating) => {
      let previousRating: ComicAnswerRating | null = null;
      setComicItems((previous) =>
        previous.map((item) => {
          if (item.answerTurnId !== turnId) return item;
          previousRating = item.currentUserRating;
          return { ...item, currentUserRating: rating };
        }),
      );

      try {
        await requestJson<{ ok: true }>(`/api/comic/answers/${turnId}/rate`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-ctf-csrf': '1',
          },
          body: JSON.stringify({ rating }),
        });
      } catch (rateError) {
        setComicItems((previous) =>
          previous.map((item) => (item.answerTurnId === turnId ? { ...item, currentUserRating: previousRating } : item)),
        );
        setError(rateError instanceof Error ? rateError.message : 'Unable to record your rating right now.');
      }
    },
    [],
  );

  // Concierge starter prompts (real questions from the landing page) for the empty home chat — a
  // one-tap way to "ask what you need" and get pointed at the right feature.
  const starterPrompts = useMemo(() => conciergeStarterPrompts(5), []);

  // Run a concierge ask: show the question as the member's own message, then an instant local reply
  // that points at the best-matching feature (with an "Open X" button), or a gentle fall-back to the
  // AI Assistant / community when nothing matches. Purely local — it does not post to the community
  // and does not touch the @comic or peer-post paths.
  const sendConciergeAsk = useCallback((promptText: string) => {
    const text = promptText.trim();
    if (!text) {
      return;
    }
    const now = new Date();
    const time = formatTimeLabel(now);
    // Stamp a real sentAtIso: the home stream sorts by epoch(sentAtIso) and falls back to the array
    // index when it is missing — without this, concierge messages got a tiny fallback epoch and sorted
    // to the TOP of the chat instead of the bottom. A real timestamp keeps them newest-last.
    const sentAtIso = now.toISOString();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const matches = resolveConcierge(text);
    const userMsg: ChatMessage = { id: `concierge-q-${stamp}`, from: 'user', text, time, sentAtIso };

    const top = matches[0];
    const second = matches[1];
    const reply: ChatMessage = top
      ? {
        id: `concierge-a-${stamp}`,
        from: 'hub',
        text: second ? `${top.blurb} (Or try ${second.name}.)` : top.blurb,
        time,
        sentAtIso,
        actionLabel: `Open ${top.name} →`,
        actionSlug: top.slug,
      }
      : {
        id: `concierge-a-${stamp}`,
        from: 'hub',
        text: 'I’m not sure which feature fits that yet — type @comic to ask the AI Assistant, or share it with the community below.',
        time,
        sentAtIso,
      };

    setMessages((previous) => mergeMessages(previous, [userMsg, reply]));
  }, []);

  return {
    messages,
    comicItems,
    input,
    setInput,
    notifyTyping,
    typingUsers,
    sendMessage,
    sendConciergeAsk,
    starterPrompts,
    rateComicAnswer,
    composerMentionsComic,
    consentModalOpen,
    confirmConsent,
    dismissConsent,
    replyTarget,
    beginReply,
    cancelReply,
    toggleReaction,
    toggleAnnouncementReaction,
    deleteMessage,
    mentionsOnly,
    toggleMentionsOnly,
    announcementsOnly,
    toggleAnnouncementsOnly,
    loadAround,
    showAllStream,
    isFilterRefreshing,
    lastSeenAtIso,
    markSeen,
    isSending,
    isLoading: connectionState === 'loading',
    isLive: connectionState === 'live',
    error,
  };
}
