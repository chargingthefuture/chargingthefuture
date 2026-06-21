'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HubJoinResponse, HubLastSeenResponse, HubMessage, HubMessagesResponse } from '../../lib/hub/types';
import { resolveConcierge, conciergeStarterPrompts } from '../../lib/concierge/resolver';
import type { ChatMessage, ChatQuotedMessage, ComicAnswerRating, ComicLinkedPlugin, ComicStreamItem, ShellCurrentUser } from './shell-types';

// The peer message the composer is currently replying to (Signal-style quote). Carries the
// quoted post's id (the reply target) plus a quote preview for the composer banner.
export type ReplyTarget = {
  postId: string;
  quote: ChatQuotedMessage;
};

type ChatConnectionState = 'loading' | 'live' | 'fallback';

type MessageAction = Pick<ChatMessage, 'actionLabel' | 'actionSlug'>;

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

function getActionForText(text: string): MessageAction | null {
  const normalized = text.toLowerCase();

  if (normalized.includes('housing') || normalized.includes('lighthouse')) {
    return { actionLabel: 'Open LightHouse →', actionSlug: 'lighthouse' };
  }

  if (normalized.includes('gdp') || normalized.includes('economy')) {
    return { actionLabel: 'Open GDP →', actionSlug: 'gdp' };
  }

  if (normalized.includes('service credit')) {
    return { actionLabel: 'Open Service Credits →', actionSlug: 'service-credits' };
  }

  if (normalized.includes('directory') || normalized.includes('provider')) {
    return { actionLabel: 'Open Directory →', actionSlug: 'directory' };
  }

  return null;
}

function buildChatMessage(
  id: string,
  from: 'hub' | 'user',
  text: string,
  time: string,
  senderLabel?: string,
): ChatMessage {
  const action = from === 'hub' ? getActionForText(text) : null;

  return {
    id,
    from,
    text,
    time,
    senderLabel,
    ...(action ?? {}),
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
    communityPostId: message.communityPostId,
    quotedMessage: message.quotedMessage,
  };
}

function getMessageDedupKey(message: ChatMessage): string {
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

  // Whether the composer currently contains an @comic mention — used to show the mention chip
  // affordance live as the asker types.
  const composerMentionsComic = useMemo(() => mentionsComic(input), [input]);

  const refreshHistory = useCallback(async () => {
    const payload = await requestJson<HubMessagesResponse>('/api/hub/messages?limit=50');
    const nextMessages = payload.messages.map((message) => mapStoredMessage(message, currentUser.userId));
    setMessages((previous) => mergeMessages(previous, nextMessages));
  }, [currentUser.userId]);

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
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load live chat history.');
        }
      }

      try {
        const join = await requestJson<HubJoinResponse>('/api/hub/join', { method: 'POST' });
        if (!active) return;
        void join;
        setConnectionState('live');
        setError(null);
        pollId = window.setInterval(() => {
          void refreshHistory().catch(() => {
            // Keep polling while the shell is mounted.
          });
          void refreshComic().catch(() => {
            // The comic stream poll is best-effort; failures must not break hub polling.
          });
        }, 10000);
      } catch (joinError) {
        if (!active) return;

        setConnectionState('fallback');
        setError(joinError instanceof Error ? joinError.message : 'Live chat is reconnecting.');
        pollId = window.setInterval(() => {
          void refreshHistory().catch(() => {
            // Polling keeps trying in fallback mode.
          });
          void refreshComic().catch(() => {
            // Best-effort comic refresh in fallback mode.
          });
        }, 15000);
      }
    }

    void bootstrapChat();

    return () => {
      active = false;
      if (pollId) {
        window.clearInterval(pollId);
      }
    };
  }, [currentUser.displayName, currentUser.userId, refreshHistory, refreshComic, refreshLastSeen]);

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
  }, [consentGranted, currentUser.userId, input, isSending, replyTarget, routeToComic]);

  // Begin a Signal-style reply to a peer message: set the composer's "replying to …" state.
  // Only peer posts carry a communityPostId, so AI answers / concierge lines cannot be replied to.
  const beginReply = useCallback((message: ChatMessage) => {
    if (!message.communityPostId) return;
    const author = message.senderLabel ?? 'Community member';
    const snippet = message.text.trim().slice(0, 120);
    setReplyTarget({ postId: message.communityPostId, quote: { author, snippet } });
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

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
    lastSeenAtIso,
    markSeen,
    isSending,
    isLoading: connectionState === 'loading',
    isLive: connectionState === 'live',
    error,
  };
}
