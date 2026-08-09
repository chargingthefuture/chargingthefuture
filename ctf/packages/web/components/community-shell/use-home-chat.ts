'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { HubJoinResponse, HubLastSeenResponse, HubMessage, HubMessagesResponse } from '../../lib/hub/types';
import { connectHubLive, type HubLiveConnection, type HubTypingUser } from '../../lib/hub/live-stream';
import { resolveConcierge, conciergeStarterPrompts } from '../../lib/concierge/resolver';
import { hubSuggestionChips } from '../../lib/concierge/hub-suggestions';
import type { ChatMessage, ChatQuotedMessage, ChatReactionSummary, ComicAnswerRating, ComicLinkedPlugin, ComicStreamItem, ShellCurrentUser } from './shell-types';
import { FEED_REACTION_EMOJIS } from '../../lib/feed/constants';

// Poll cadence: the 10s poll is the only refresh path when the live Stream connection is absent or
// degraded. When the live connection is healthy, real-time events drive refreshes and the poll is a
// slow backstop only, so it runs far less often to cut request volume.
const POLL_INTERVAL_FALLBACK_MS = 10_000;
const POLL_INTERVAL_LIVE_MS = 30_000;

// Shared headers for a JSON POST that also carries the CSRF marker the backend expects.
const JSON_CSRF_HEADERS = { 'content-type': 'application/json', 'x-ctf-csrf': '1' } as const;

// The peer message the composer is currently replying to (Signal-style quote). Carries the
// quoted post's id (the reply target) plus a quote preview for the composer banner.
export type ReplyTarget = {
  postId: string;
  quote: ChatQuotedMessage;
};

type ChatConnectionState = 'loading' | 'live' | 'fallback';

// The active stream filter: mentions and announcements are mutually exclusive; 'all' is the
// unfiltered blended stream.
type FilterKey = 'mentions' | 'announcements' | 'all';

// A stable bundle of every state setter. Action helpers live at module scope and take this one
// argument instead of a long list of setters; the setters never change identity, so the hook holds
// the bundle in a ref that is written once.
type ChatSetters = {
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setComicItems: Dispatch<SetStateAction<ComicStreamItem[]>>;
  setInput: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setReplyTarget: Dispatch<SetStateAction<ReplyTarget | null>>;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setConsentGranted: Dispatch<SetStateAction<boolean>>;
  setConsentModalOpen: Dispatch<SetStateAction<boolean>>;
  setPendingConsentText: Dispatch<SetStateAction<string | null>>;
  setLastSeenAtIso: Dispatch<SetStateAction<string | null>>;
  setConnectionState: Dispatch<SetStateAction<ChatConnectionState>>;
  setTypingUsers: Dispatch<SetStateAction<HubTypingUser[]>>;
  setIsFilterRefreshing: Dispatch<SetStateAction<boolean>>;
};

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

// Collapse the repeated "surface an Error message or a fallback" pattern used by every catch block.
function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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

// The query-string fragment the server expects for each filter mode.
function filterParamForKey(key: FilterKey): string {
  if (key === 'mentions') return '&mentions=me';
  if (key === 'announcements') return '&channel=announcements';
  return '';
}

// The "load around" query-string fragment for a deep-linked post/announcement, empty when neither.
function aroundParamFor(postId: string | null, announcementId: string | null): string {
  if (postId) return `&aroundPost=${encodeURIComponent(postId)}`;
  if (announcementId) return `&aroundAnnouncement=${encodeURIComponent(announcementId)}`;
  return '';
}

// Read a page of history and merge it into the stream, but ignore a response that raced a mode flip
// (e.g. a slow read landing after the member changed the filter) so a filtered view never gets
// polluted with the wrong stream.
async function fetchHistoryIntoState(
  extraParam: string,
  readFilterKey: () => FilterKey,
  expectedKey: FilterKey,
  currentUserId: string,
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
): Promise<void> {
  const payload = await requestJson<HubMessagesResponse>(`/api/hub/messages?limit=50${extraParam}`);
  if (readFilterKey() !== expectedKey) {
    return;
  }
  const nextMessages = payload.messages.map((message) => mapStoredMessage(message, currentUserId));
  setMessages((previous) => mergeMessages(previous, nextMessages));
}

// Read the comic conversation stream and merge it over the local (optimistic) items.
async function readComicInto(setters: ChatSetters): Promise<void> {
  const payload = await requestJson<ComicConversationResponse>('/api/comic/conversation?limit=30');
  const serverItems: ComicStreamItem[] = payload.items.map((item) => ({ ...item }));
  setters.setComicItems((previous) => mergeComicItems(serverItems, previous));
}

// Read the member's last-seen marker once on entry so the chat can place the "New messages"
// divider. Best-effort: a failure leaves the marker null (everything reads as already seen, i.e.
// no divider) and never blocks the chat.
async function readLastSeenInto(setters: ChatSetters): Promise<void> {
  try {
    const payload = await requestJson<HubLastSeenResponse>('/api/hub/last-seen');
    setters.setLastSeenAtIso(payload.lastSeenAtIso);
  } catch {
    setters.setLastSeenAtIso(null);
  }
}

// Clear the loaded messages and re-fetch in the current filter mode. The list is cleared first so
// modes never blend (merge is additive, so a shared list would keep old rows around).
function runFilterRefresh(setters: ChatSetters, refreshHistory: () => Promise<void>): void {
  setters.setMessages([]);
  setters.setIsFilterRefreshing(true);
  void refreshHistory()
    .catch(() => {
      // Best-effort: the poll retries shortly; the empty state covers the gap.
    })
    .finally(() => setters.setIsFilterRefreshing(false));
}

// The stable refs and setters the mutually-exclusive filter toggles read and write.
type FilterRefs = {
  mentionsOnlyRef: RefObject<boolean>;
  announcementsOnlyRef: RefObject<boolean>;
  setMentionsOnly: Dispatch<SetStateAction<boolean>>;
  setAnnouncementsOnly: Dispatch<SetStateAction<boolean>>;
};

// Apply a mutually-exclusive filter selection to the refs + state mirrors, then re-fetch. Mentions
// and announcements can never both be on, so callers pass the exact pair they want.
function flipFilter(mentions: boolean, announcements: boolean, refs: FilterRefs, refreshForFilterChange: () => void): void {
  refs.mentionsOnlyRef.current = mentions;
  refs.announcementsOnlyRef.current = announcements;
  refs.setMentionsOnly(mentions);
  refs.setAnnouncementsOnly(announcements);
  refreshForFilterChange();
}

// The composer's "replying to …" target for a peer message, or null when the message is not a peer
// post (only peer posts carry a communityPostId, so AI answers / concierge lines cannot be replied to).
function buildReplyTarget(message: ChatMessage): ReplyTarget | null {
  if (!message.communityPostId) return null;
  const author = message.senderLabel ?? 'Community member';
  const snippet = message.text.trim().slice(0, 120);
  return { postId: message.communityPostId, quote: { author, snippet, postId: message.communityPostId } };
}

// Editing IS delete + repost — there is no in-place edit — so load the post's text back into the
// composer, clear any active reply, and delete the original.
function runEditMessage(
  postId: string,
  text: string,
  setters: ChatSetters,
  deleteMessage: (postId: string) => Promise<void>,
): void {
  setters.setReplyTarget(null);
  setters.setInput(text);
  void deleteMessage(postId);
}

// Mark "seen" at most once per mount and never push the marker backwards.
function markSeenOnce(markedSeenRef: RefObject<boolean>): void {
  if (markedSeenRef.current) return;
  markedSeenRef.current = true;
  void postSeenMarker();
}

// POST the member's last-seen marker. Best-effort: a failure is swallowed so it can never break the
// chat, and the caller leaves its "already marked" guard set so a transient failure does not retry-spam.
async function postSeenMarker(): Promise<void> {
  try {
    await requestJson<HubLastSeenResponse>('/api/hub/last-seen', {
      method: 'POST',
      headers: JSON_CSRF_HEADERS,
      body: JSON.stringify({ seenAtIso: new Date().toISOString() }),
    });
  } catch {
    // Best-effort: leave the guard set so a transient failure does not retry-spam.
  }
}

// The optimistic "Reviewing for safety" card shown while an @comic ask awaits human approval.
function buildOptimisticComicItem(question: string): ComicStreamItem {
  // Unique per ask (random suffix) so two rapid identical-text asks get distinct React keys and
  // are tracked independently by the count-aware merge.
  const localId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
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
}

// Route an @comic question to the assistant. The server returns ONLY a holding response (202) —
// never the unreviewed draft — so we optimistically render the pending card and rely on the polling
// stream to surface the answer once a human approves it.
async function runRouteToComic(questionText: string, refreshComic: () => Promise<void>, setters: ChatSetters): Promise<void> {
  const question = stripComicMention(questionText);
  const optimisticItem = buildOptimisticComicItem(question);
  setters.setComicItems((previous) => [...previous, optimisticItem]);

  try {
    await requestJson<ComicMessageResponse>('/api/comic/message', {
      method: 'POST',
      headers: JSON_CSRF_HEADERS,
      body: JSON.stringify({ body: questionText, channel: 'hub', consentGranted: true }),
    });
    // Pull the server stream so the pending card reflects the persisted turn.
    await refreshComic().catch(() => undefined);
  } catch (sendError) {
    // Drop the optimistic card on failure and surface the error.
    setters.setComicItems((previous) => previous.filter((item) => item.questionTurnId !== optimisticItem.questionTurnId));
    setters.setError(toErrorMessage(sendError, 'Unable to reach the AI Assistant right now.'));
  }
}

// Everything the composer send path needs. Values are read once per send; setters are stable.
type SendMessageContext = {
  input: string;
  isSending: boolean;
  consentGranted: boolean;
  replyTarget: ReplyTarget | null;
  currentUserId: string;
  routeToComic: (questionText: string) => Promise<void>;
  notifyStopTyping: () => void;
  setters: ChatSetters;
};

// The JSON body for a peer post: with a reply target it carries the reply reference and the quote
// the sender saw; otherwise just the text.
function buildPeerMessageBody(text: string, activeReply: ReplyTarget | null): string {
  return JSON.stringify(
    activeReply
      ? { text, replyToPostId: activeReply.postId, quotedMessage: activeReply.quote }
      : { text },
  );
}

// Send a peer-to-peer community post and merge the saved copy in. On failure, restore the reply
// target and the composer text so the member can retry.
async function postPeerMessage(text: string, activeReply: ReplyTarget | null, ctx: SendMessageContext): Promise<void> {
  try {
    const payload = await requestJson<{ ok: true; message: HubMessage }>('/api/hub/messages', {
      method: 'POST',
      headers: JSON_CSRF_HEADERS,
      body: buildPeerMessageBody(text, activeReply),
    });
    const savedMessage = mapStoredMessage(payload.message, ctx.currentUserId);
    ctx.setters.setMessages((previous) => mergeMessages(previous, [savedMessage]));
  } catch (sendError) {
    // Restore the reply target so the member can retry the reply.
    if (activeReply) {
      ctx.setters.setReplyTarget(activeReply);
    }
    // Put the text back in the composer (owner report, 2026-07-27). The input is cleared
    // optimistically by the caller so the send feels instant; before this, a rejected send — a
    // message over the length cap, or any network failure — cleared the box and the member's writing
    // was gone with nothing to retry. Only restore when the member has not started typing something
    // new in the meantime, so a recovery never overwrites live work.
    ctx.setters.setInput((current) => (current.trim().length === 0 ? text : current));
    ctx.setters.setError(toErrorMessage(sendError, 'Unable to send your message right now.'));
  }
}

// @comic mention → AI Assistant. Gate the first use behind the consent modal, holding the text.
async function sendComicFromComposer(text: string, ctx: SendMessageContext): Promise<void> {
  if (!ctx.consentGranted) {
    ctx.setters.setPendingConsentText(text);
    ctx.setters.setConsentModalOpen(true);
    return;
  }

  ctx.setters.setIsSending(true);
  ctx.setters.setError(null);
  ctx.setters.setInput('');
  try {
    await ctx.routeToComic(text);
  } finally {
    ctx.setters.setIsSending(false);
  }
}

// No mention → peer-to-peer community post via the existing hub path. Capture the active reply
// target (Signal-style quote) before clearing it, and clear the typing indicator right away.
async function sendPeerFromComposer(text: string, ctx: SendMessageContext): Promise<void> {
  const activeReply = ctx.replyTarget;
  ctx.setters.setIsSending(true);
  ctx.setters.setError(null);
  ctx.setters.setInput('');
  ctx.setters.setReplyTarget(null);
  ctx.notifyStopTyping();
  try {
    await postPeerMessage(text, activeReply, ctx);
  } finally {
    ctx.setters.setIsSending(false);
  }
}

async function runSendMessage(ctx: SendMessageContext): Promise<void> {
  const text = ctx.input.trim();
  if (!text || ctx.isSending) {
    return;
  }

  if (mentionsComic(text)) {
    await sendComicFromComposer(text, ctx);
    return;
  }

  await sendPeerFromComposer(text, ctx);
}

// Toggle the current member's emoji reaction on every message matching the predicate. Optimistically
// flips the chip (count + reactedByMe), then POSTs; on failure the optimistic change is reverted
// (toggling the same emoji again undoes it). A fresh history load reconciles to the server aggregate.
async function toggleMessageReaction(
  matchesTarget: (message: ChatMessage) => boolean,
  emoji: string,
  url: string,
  setters: ChatSetters,
): Promise<void> {
  const flip = (previous: ChatMessage[]): ChatMessage[] =>
    previous.map((message) => (matchesTarget(message) ? applyReactionToggle(message, emoji) : message));

  setters.setMessages(flip);

  try {
    await requestJson<{ ok: true; reacted: boolean }>(url, {
      method: 'POST',
      headers: JSON_CSRF_HEADERS,
      body: JSON.stringify({ emoji }),
    });
  } catch (reactError) {
    setters.setMessages(flip);
    setters.setError(toErrorMessage(reactError, 'Unable to update your reaction right now.'));
  }
}

// Toggle the member's reaction on a peer post, keyed on the community post id.
function togglePostReaction(postId: string, emoji: string, setters: ChatSetters): Promise<void> {
  return toggleMessageReaction(
    (message) => message.communityPostId === postId,
    emoji,
    `/api/hub/messages/${encodeURIComponent(postId)}/reactions`,
    setters,
  );
}

// Toggle the member's reaction on an official announcement, keyed on the announcement id.
function toggleAnnouncementReactionFor(announcementId: string, emoji: string, setters: ChatSetters): Promise<void> {
  return toggleMessageReaction(
    (message) => message.announcementId === announcementId,
    emoji,
    `/api/announcements/${encodeURIComponent(announcementId)}/reactions`,
    setters,
  );
}

// Delete one of the member's own peer posts. Optimistically drops it from the stream, then DELETEs;
// on failure the post is restored and an error is shown. Server enforces author-only.
async function runDeleteMessage(postId: string, setters: ChatSetters): Promise<void> {
  let removed: ChatMessage[] = [];
  setters.setMessages((previous) => {
    removed = previous.filter((message) => message.communityPostId === postId);
    return previous.filter((message) => message.communityPostId !== postId);
  });

  try {
    await requestJson<{ ok: true; postId: string }>(`/api/hub/messages/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers: { 'x-ctf-csrf': '1' },
    });
  } catch (deleteError) {
    // Restore the optimistically removed post(s) and surface the error.
    if (removed.length > 0) {
      setters.setMessages((previous) => mergeMessages(previous, removed));
    }
    setters.setError(toErrorMessage(deleteError, 'Unable to delete your post right now.'));
  }
}

// Rate an answered AI Assistant card. Optimistically reflects the choice; reverts on failure.
async function runRateComicAnswer(turnId: string, rating: ComicAnswerRating, setters: ChatSetters): Promise<void> {
  let previousRating: ComicAnswerRating | null = null;
  setters.setComicItems((previous) =>
    previous.map((item) => {
      if (item.answerTurnId !== turnId) return item;
      previousRating = item.currentUserRating;
      return { ...item, currentUserRating: rating };
    }),
  );

  try {
    await requestJson<{ ok: true }>(`/api/comic/answers/${turnId}/rate`, {
      method: 'POST',
      headers: JSON_CSRF_HEADERS,
      body: JSON.stringify({ rating }),
    });
  } catch (rateError) {
    setters.setComicItems((previous) =>
      previous.map((item) => (item.answerTurnId === turnId ? { ...item, currentUserRating: previousRating } : item)),
    );
    setters.setError(toErrorMessage(rateError, 'Unable to record your rating right now.'));
  }
}

// Build the member's question message plus the instant local concierge reply for a concierge ask.
// Purely local — points at the best-matching feature (with an "Open X" button), or a gentle
// fall-back when nothing matches. Returns an empty array for empty input.
function buildConciergeMessages(promptText: string): ChatMessage[] {
  const text = promptText.trim();
  if (!text) {
    return [];
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

  return [userMsg, reply];
}

// Run a concierge ask: append the member's question plus the instant local reply. No-op for empty input.
function applyConciergeAsk(promptText: string, setters: ChatSetters): void {
  const next = buildConciergeMessages(promptText);
  if (next.length === 0) {
    return;
  }
  setters.setMessages((previous) => mergeMessages(previous, next));
}

// One-tap "ask @comic" for a suggestion chip (issue #471): route a fixed question straight to the AI
// assistant, no composer step. The @comic mention is added by the caller. Same consent gate and
// holding-card flow the composer uses; on first use the consent modal opens holding the mentioned text.
type AskComicContext = {
  isSending: boolean;
  consentGranted: boolean;
  routeToComic: (questionText: string) => Promise<void>;
  setters: ChatSetters;
};

function runAskComic(question: string, ctx: AskComicContext): void {
  const clean = question.trim();
  if (!clean || ctx.isSending) return;
  const mentioned = `@comic ${clean}`;
  if (!ctx.consentGranted) {
    ctx.setters.setPendingConsentText(mentioned);
    ctx.setters.setConsentModalOpen(true);
    return;
  }
  ctx.setters.setIsSending(true);
  ctx.setters.setError(null);
  void ctx.routeToComic(mentioned).finally(() => ctx.setters.setIsSending(false));
}

type ConfirmConsentContext = {
  userId: string;
  pendingConsentText: string | null;
  routeToComic: (questionText: string) => Promise<void>;
  setters: ChatSetters;
};

// Consent modal "Not now": close the modal and drop the held text.
function dismissConsentState(setters: ChatSetters): void {
  setters.setConsentModalOpen(false);
  setters.setPendingConsentText(null);
}

// Consent modal "Confirm": persist consent and send the held @comic question.
async function runConfirmConsent(ctx: ConfirmConsentContext): Promise<void> {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(consentStorageKey(ctx.userId), '1');
  }
  ctx.setters.setConsentGranted(true);
  ctx.setters.setConsentModalOpen(false);

  const held = ctx.pendingConsentText;
  ctx.setters.setPendingConsentText(null);
  if (!held) return;

  ctx.setters.setIsSending(true);
  ctx.setters.setError(null);
  ctx.setters.setInput('');
  try {
    await ctx.routeToComic(held);
  } finally {
    ctx.setters.setIsSending(false);
  }
}

// A single mount's bootstrap lifecycle flags: `active` guards against work after unmount, `pollId`
// holds the running poll so cleanup can clear it.
type BootstrapController = { active: boolean; pollId: number | undefined };

// Everything the bootstrap needs from the hook: refresh callbacks, the refs the live handler and
// cleanup reach through, and the state setters.
type ChatBootstrapContext = {
  controller: BootstrapController;
  refreshHistory: () => Promise<void>;
  refreshComic: () => Promise<void>;
  refreshLastSeen: () => Promise<void>;
  loadAroundDeepLink: () => Promise<void>;
  refreshHistoryRef: RefObject<() => Promise<void>>;
  liveConnectionRef: RefObject<HubLiveConnection | null>;
  setters: ChatSetters;
};

// Reset per-mount state so re-entering the chat reads the marker afresh and can mark seen once more.
function resetChatForMount(setters: ChatSetters, markedSeenRef: RefObject<boolean>): void {
  setters.setConnectionState('loading');
  setters.setError(null);
  setters.setMessages([]);
  setters.setComicItems([]);
  markedSeenRef.current = false;
  setters.setLastSeenAtIso(null);
}

// Both the live path and the polling-only path keep a poll running. `intervalMs` is short when we
// are polling-only and long when a healthy live connection is the primary refresh path.
function startChatPoll(ctx: ChatBootstrapContext, intervalMs: number): void {
  ctx.controller.pollId = window.setInterval(() => {
    void ctx.refreshHistory().catch(() => {
      // Keep polling while the shell is mounted.
    });
    void ctx.refreshComic().catch(() => {
      // The comic stream poll is best-effort; failures must not break hub polling.
    });
  }, intervalMs);
}

// Read the last-seen marker before history settles so the divider can be placed on the first render
// of the stream, then load the recent page, comic stream, and any deep-link window. Best-effort.
async function loadInitialChatHistory(ctx: ChatBootstrapContext): Promise<void> {
  void ctx.refreshLastSeen();
  try {
    await Promise.all([ctx.refreshHistory(), ctx.refreshComic().catch(() => undefined)]);
    // After the recent page loads, pull the deep-link target's window (if any) and merge it in.
    void ctx.loadAroundDeepLink().catch(() => undefined);
  } catch (loadError) {
    if (ctx.controller.active) {
      ctx.setters.setError(toErrorMessage(loadError, 'Unable to load live chat history.'));
    }
  }
}

// Open the live Stream connection only when the server actually minted credentials. When Stream is
// not configured (configured: false) we never attempt a connection and simply poll — Commons must
// keep working without Stream.
async function connectLiveWhenConfigured(
  join: HubJoinResponse,
  ctx: ChatBootstrapContext,
): Promise<HubLiveConnection | null> {
  if (!join.configured) {
    return null;
  }
  return connectHubLive(
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
        void ctx.refreshHistoryRef.current().catch(() => undefined);
      },
      onTypingChange: (typing) => {
        if (ctx.controller.active) ctx.setters.setTypingUsers(typing);
      },
    },
  );
}

// Join the hub, open the live connection when possible, and start the appropriate poll. On join
// failure, fall back to the frequent poll.
async function joinAndConnect(ctx: ChatBootstrapContext): Promise<void> {
  try {
    // The join route gates on Origin today, not on this header, so the call works without it. The
    // header is sent so the join keeps working if the route ever moves to the header-based check
    // that the rest of the Commons POSTs use, and so no Commons mutation is the odd one out.
    const join = await requestJson<HubJoinResponse>('/api/hub/join', {
      method: 'POST',
      headers: { 'x-ctf-csrf': '1' },
    });
    if (!ctx.controller.active) return;
    ctx.setters.setConnectionState('live');
    ctx.setters.setError(null);

    const live = await connectLiveWhenConfigured(join, ctx);

    if (!ctx.controller.active) {
      // Unmounted while connecting; tear the connection down rather than leak it.
      if (live) void live.disconnect();
      return;
    }

    if (live) {
      ctx.liveConnectionRef.current = live;
      // Live connection drives refreshes; the poll becomes a slow backstop.
      startChatPoll(ctx, POLL_INTERVAL_LIVE_MS);
    } else {
      // Stream not configured, or the live connection failed to open: silently stay on the frequent
      // poll. The chat is fully functional this way.
      ctx.setters.setTypingUsers([]);
      startChatPoll(ctx, POLL_INTERVAL_FALLBACK_MS);
    }
  } catch (joinError) {
    if (!ctx.controller.active) return;

    ctx.setters.setConnectionState('fallback');
    ctx.setters.setError(toErrorMessage(joinError, 'Live chat is reconnecting.'));
    startChatPoll(ctx, POLL_INTERVAL_FALLBACK_MS);
  }
}

async function runChatBootstrap(ctx: ChatBootstrapContext): Promise<void> {
  await loadInitialChatHistory(ctx);
  await joinAndConnect(ctx);
}

// Unmount cleanup: stop the poll and disconnect the live Stream client so we never leak a connection.
function teardownBootstrap(controller: BootstrapController, liveConnectionRef: RefObject<HubLiveConnection | null>): void {
  controller.active = false;
  if (controller.pollId) {
    window.clearInterval(controller.pollId);
  }
  const live = liveConnectionRef.current;
  liveConnectionRef.current = null;
  if (live) {
    void live.disconnect();
  }
}

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

  // Stable bundles so module-scope helpers can update state / read filter refs without long argument
  // lists. Setters and refs never change identity, so each ref is written once on first render.
  const settersRef = useRef<ChatSetters>({
    setMessages,
    setComicItems,
    setInput,
    setError,
    setReplyTarget,
    setIsSending,
    setConsentGranted,
    setConsentModalOpen,
    setPendingConsentText,
    setLastSeenAtIso,
    setConnectionState,
    setTypingUsers,
    setIsFilterRefreshing,
  });
  const filtersRef = useRef<FilterRefs>({
    mentionsOnlyRef,
    announcementsOnlyRef,
    setMentionsOnly,
    setAnnouncementsOnly,
  });

  // Whether the composer currently contains an @comic mention — used to show the mention chip
  // affordance live as the asker types.
  const composerMentionsComic = useMemo(() => mentionsComic(input), [input]);

  // The active stream filter, derived from the refs so the poll/live handlers (which hold older
  // callback identities) always read the current mode. Mentions and announcements are mutually
  // exclusive; 'all' is the unfiltered blended stream.
  const currentFilterKey = (): FilterKey =>
    mentionsOnlyRef.current ? 'mentions' : announcementsOnlyRef.current ? 'announcements' : 'all';

  const refreshHistory = useCallback(async () => {
    const filterKey = currentFilterKey();
    await fetchHistoryIntoState(filterParamForKey(filterKey), currentFilterKey, filterKey, currentUser.userId, setMessages);
  }, [currentUser.userId]);

  // Deep-link "load around": pull a page centered on a specific message/announcement from the server
  // and merge it in, so a target older than the recent page is present for the stream to scroll to.
  // Best-effort and additive — the recent page still loads alongside, so the member sees both the old
  // message and current activity. Only applies to the unfiltered stream (a deep link is not a
  // mentions/announcements view), so it no-ops while a filter is active.
  const loadAround = useCallback(async (postId: string | null, announcementId: string | null) => {
    const aroundParam = aroundParamFor(postId, announcementId);
    if (!aroundParam || currentFilterKey() !== 'all') return;
    await fetchHistoryIntoState(aroundParam, currentFilterKey, 'all', currentUser.userId, setMessages);
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

  const refreshComic = useCallback(() => readComicInto(settersRef.current), []);

  const refreshLastSeen = useCallback(() => readLastSeenInto(settersRef.current), []);

  // Move the last-seen marker to now after the member has viewed the chat. Best-effort and at most
  // once per mount; a failure is swallowed so it can never break the chat.
  const markSeen = useCallback(() => markSeenOnce(markedSeenRef), []);

  const refreshForFilterChange = useCallback(
    () => runFilterRefresh(settersRef.current, refreshHistory),
    [refreshHistory],
  );

  // Flip the "@ Mentions" filter. Turning it on clears the mutually-exclusive announcements filter.
  const toggleMentionsOnly = useCallback(
    () => flipFilter(!mentionsOnlyRef.current, false, filtersRef.current, refreshForFilterChange),
    [refreshForFilterChange],
  );

  // Flip the announcements (📣) filter. Turning it on clears the mutually-exclusive mentions filter.
  const toggleAnnouncementsOnly = useCallback(
    () => flipFilter(false, !announcementsOnlyRef.current, filtersRef.current, refreshForFilterChange),
    [refreshForFilterChange],
  );

  // Force the unfiltered blended stream (used when a deep link must land but a filter is active).
  // Clears both filters and re-fetches; a no-op when neither filter is on.
  const showAllStream = useCallback(() => {
    if (!mentionsOnlyRef.current && !announcementsOnlyRef.current) return;
    flipFilter(false, false, filtersRef.current, refreshForFilterChange);
  }, [refreshForFilterChange]);

  // Emit a typing event as the member writes in the composer. No-op when there is no live
  // connection (polling-only mode), so the composer can call it unconditionally on every keystroke.
  const notifyTyping = useCallback(() => liveConnectionRef.current?.sendTyping(), []);

  // Tell the channel the member has stopped typing (e.g. after sending). Best-effort; no-op when not live.
  const notifyStopTyping = useCallback(() => liveConnectionRef.current?.stopTyping(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setConsentGranted(window.localStorage.getItem(consentStorageKey(currentUser.userId)) === '1');
  }, [currentUser.userId]);

  useEffect(() => {
    const controller: BootstrapController = { active: true, pollId: undefined };
    resetChatForMount(settersRef.current, markedSeenRef);
    void runChatBootstrap({
      controller,
      refreshHistory,
      refreshComic,
      refreshLastSeen,
      loadAroundDeepLink,
      refreshHistoryRef,
      liveConnectionRef,
      setters: settersRef.current,
    });
    return () => teardownBootstrap(controller, liveConnectionRef);
    // Deliberately keyed on userId only: nothing in the bootstrap reads the display name (incoming
    // messages carry their own sender name from the server), so listing it here tore down the whole
    // chat — cleared messages, re-joined, restarted the poll — every time a member edited their name.
  }, [currentUser.userId, refreshHistory, refreshComic, refreshLastSeen, loadAroundDeepLink]);

  const routeToComic = useCallback(
    (questionText: string) => runRouteToComic(questionText, refreshComic, settersRef.current),
    [refreshComic],
  );

  const sendMessage = useCallback(
    () =>
      runSendMessage({
        input,
        isSending,
        consentGranted,
        replyTarget,
        currentUserId: currentUser.userId,
        routeToComic,
        notifyStopTyping,
        setters: settersRef.current,
      }),
    [consentGranted, currentUser.userId, input, isSending, notifyStopTyping, replyTarget, routeToComic],
  );

  const askComic = useCallback(
    (question: string) => runAskComic(question, { isSending, consentGranted, routeToComic, setters: settersRef.current }),
    [consentGranted, isSending, routeToComic],
  );

  // Begin a Signal-style reply to a peer message: set the composer's "replying to …" state.
  const beginReply = useCallback((message: ChatMessage) => {
    const target = buildReplyTarget(message);
    if (target) setReplyTarget(target);
  }, []);

  const cancelReply = useCallback(() => setReplyTarget(null), []);

  // Toggle the current member's emoji reaction on a peer post, keyed on the community post id.
  const toggleReaction = useCallback(
    (postId: string, emoji: string) => togglePostReaction(postId, emoji, settersRef.current),
    [],
  );

  // Toggle the current member's emoji reaction on an official announcement, keyed on the announcement id.
  const toggleAnnouncementReaction = useCallback(
    (announcementId: string, emoji: string) => toggleAnnouncementReactionFor(announcementId, emoji, settersRef.current),
    [],
  );

  // Delete one of the member's own peer posts. The product has no edit — to change a post you
  // delete and repost — so this removes the post outright.
  const deleteMessage = useCallback((postId: string) => runDeleteMessage(postId, settersRef.current), []);

  // Edit one of the member's own peer posts. Editing IS delete + repost — load the text back into the
  // composer and delete the original; the member tweaks it and sends a fresh post.
  const editMessage = useCallback(
    (postId: string, text: string) => runEditMessage(postId, text, settersRef.current, deleteMessage),
    [deleteMessage],
  );

  // Consent modal "Confirm": persist consent and send the held @comic question.
  const confirmConsent = useCallback(
    () =>
      runConfirmConsent({ userId: currentUser.userId, pendingConsentText, routeToComic, setters: settersRef.current }),
    [currentUser.userId, pendingConsentText, routeToComic],
  );

  // Consent modal "Not now": do not route, and do NOT populate the composer. When the modal was
  // opened from a composer-typed @comic message the text is already in the input (the send path never
  // cleared it), so it stays put on its own. When it was opened from a one-tap suggestion chip the
  // input was empty, so we must leave it empty — dropping the chip's "@comic …" question into the box
  // (the old behavior) looked like a message queued to send that the member never wrote.
  const dismissConsent = useCallback(() => dismissConsentState(settersRef.current), []);

  // Rate an answered AI Assistant card. Optimistically reflects the choice; reverts on failure.
  const rateComicAnswer = useCallback(
    (turnId: string, rating: ComicAnswerRating) => runRateComicAnswer(turnId, rating, settersRef.current),
    [],
  );

  // The curated one-tap suggestion chips shown under the composer (#471): navigation chips open a
  // plugin; ask chips route to @comic. Each chip's behavior is explicit (see hub-suggestions).
  const suggestionChips = useMemo(() => hubSuggestionChips(), []);

  // Concierge starter prompts (real questions from the landing page) for the empty home chat — a
  // one-tap way to "ask what you need" and get pointed at the right feature. Retained for the local
  // concierge path (`sendConciergeAsk`); the visible chip row now uses `suggestionChips`.
  const starterPrompts = useMemo(() => conciergeStarterPrompts(5), []);

  // Run a concierge ask: show the question as the member's own message, then an instant local reply
  // that points at the best-matching feature. Purely local — it does not post to the community and
  // does not touch the @comic or peer-post paths.
  const sendConciergeAsk = useCallback((promptText: string) => applyConciergeAsk(promptText, settersRef.current), []);

  return {
    messages,
    comicItems,
    input,
    setInput,
    notifyTyping,
    typingUsers,
    sendMessage,
    sendConciergeAsk,
    askComic,
    starterPrompts,
    suggestionChips,
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
    editMessage,
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
