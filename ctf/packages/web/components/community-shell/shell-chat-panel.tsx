'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AtSign, Pencil, Reply, Trash2, X } from 'lucide-react';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { PublicCommunityPost } from '../../lib/feed/types';
import { feedAuthorHandle } from '../../lib/feed/author-handle';
import type {
  ChatMessage,
  ChatQuotedMessage,
  ComicAnswerRating,
  ComicStreamItem,
  ShellCurrentUser,
  ShellStats,
} from './shell-types';
import { useHomeChat, type ReplyTarget } from './use-home-chat';
import { ComicAnswerCard, ComicPendingCard } from './comic-cards';
import { AnnouncementCard } from './announcement-card';
import { NotificationsPanel } from './notifications-panel';
import { ChatReactionRow } from './chat-reaction-row';
import { ComicConsentModal } from './comic-consent-modal';
import type { HubTypingUser } from '../../lib/hub/live-stream';
import type { HubSuggestionChip } from '../../lib/concierge/hub-suggestions';
import styles from './community-shell.module.css';
import { feedPostLength } from '../../lib/feed/normalize';
import { FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH, FEED_MAX_COMMUNITY_POST_LENGTH } from '../../lib/feed/constants';

// Avatar glyph for a chat sender: "SH" for the Survivor Hub system/AI, otherwise the first letter of
// the member's handle. Keeps each post attributable instead of every row reading as the same "SH".
function avatarFromSender(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed.toLowerCase() === 'survivor hub') return 'SH';
  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return handle.charAt(0).toUpperCase() || 'SH';
}

// One unified stream entry: either a peer/hub chat message or an AI Assistant (@comic) Q&A item.
// Each entry carries a numeric `epoch` (ms) so hub messages and comic items interleave in true
// chronological order — the design shows AI cards woven among community posts, not appended after.
type StreamEntry =
  | { kind: 'message'; message: ChatMessage; epoch: number; order: number }
  | { kind: 'comic'; item: ComicStreamItem; epoch: number; order: number };

type AuthenticatedChatPanelProps = {
  stats: ShellStats;
  plugins: PluginRegistryItem[];
  currentUser: ShellCurrentUser;
  isAdmin?: boolean;
};

type ShellChatPanelProps = {
  stats: ShellStats;
  plugins: PluginRegistryItem[];
  currentUser: ShellCurrentUser;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  signInUrl?: string;
};

export function ShellChatPanel({ stats, plugins, currentUser, isAuthenticated = false, isAdmin = false, signInUrl = '/sign-in' }: ShellChatPanelProps) {
  if (isAuthenticated) {
    return <AuthenticatedChatPanel stats={stats} plugins={plugins} currentUser={currentUser} isAdmin={isAdmin} />;
  }

  return <PublicCommunityPanel stats={stats} plugins={plugins} signInUrl={signInUrl} />;
}

function formatPostTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// A stable hue (0–359) derived from an author's handle, so the same member always gets the same
// color. Both the avatar and the row highlight read from this, keeping one person's posts in one
// consistent color family.
function authorHue(authorUsername: string): number {
  let hash = 0;
  for (let index = 0; index < authorUsername.length; index += 1) {
    hash = (hash * 31 + authorUsername.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}

// Deterministic avatar tint for a signed-out community post, keyed on the author's handle, so
// distinct members read as distinct people instead of one purple stream. Posts with no handle
// (anonymized "Community member") share a single neutral slate tint.
function publicAvatarBackground(authorUsername: string | null): string {
  if (!authorUsername) {
    return 'linear-gradient(135deg, #475569 0%, #334155 100%)';
  }
  const hue = authorHue(authorUsername);
  return `linear-gradient(135deg, hsl(${hue}, 62%, 55%) 0%, hsl(${(hue + 38) % 360}, 62%, 45%) 100%)`;
}

// Faint per-author highlight for a signed-out message row (Discord-style list). Same hue family as
// the author's avatar, but heavily desaturated and nearly transparent, so it reads as a subtle row
// highlight — not a colored bubble — while consecutive messages from different members still
// alternate visibly. Anonymized posts (no handle) share a neutral near-invisible white wash.
function publicRowBackground(authorUsername: string | null): string {
  if (!authorUsername) {
    return 'rgba(255, 255, 255, 0.04)';
  }
  const hue = authorHue(authorUsername);
  return `hsla(${hue}, 30%, 50%, 0.09)`;
}

// Signed-out Commons: community (peer) posts are public the way Quora posts are, so a not-signed-in
// visitor reads them here — read-only and nothing else (no AI assistant, no concierge chips, no
// composer). Posts come from the public, unauthenticated endpoint, which itself only returns posts
// when an admin has turned public viewing on. When public viewing is off (or the read fails), we fall
// back to the plain sign-in prompt. A single sign-in call-to-action lets a visitor join to take part.
function PublicCommunityPanel({ plugins, signInUrl }: { stats: ShellStats; plugins: PluginRegistryItem[]; signInUrl: string }) {
  const implementedCount = plugins.filter((plugin) => plugin.availabilityState === 'implemented_shell').length;

  const [posts, setPosts] = useState<PublicCommunityPost[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/feed/public/community', { cache: 'no-store' });
        if (!res.ok) throw new Error('public_community_unavailable');
        const data = (await res.json()) as { isPublic: boolean; posts: PublicCommunityPost[] };
        if (!active) return;
        setIsPublic(Boolean(data.isPublic));
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch {
        if (!active) return;
        setIsPublic(false);
        setPosts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const hasPosts = isPublic && posts.length > 0;

  return (
    <div className={styles.chatPanelWrap}>
      <div className={styles.heroBanner}>
        <div className={styles.heroBannerContent}>
          <p className={styles.heroBannerTag}>✦ From Survivor to Thriver</p>
          <h1 className={styles.heroBannerTitle}>Welcome to Skills Economy</h1>
          <p className={styles.heroBannerSub}>Connect with your community. Access {implementedCount} live plugins for housing, work, safety, and support.</p>
        </div>
        {/* Stats are hidden on phones, where the three blocks filled a quarter of the first screen
            before any community posts were visible (the authenticated panel already hides its whole
            hero on mobile). The title + description above stay. */}
      </div>

      <div className={styles.chatMessages}>
        {loading ? (
          <p className={styles.chatFootnote}>Loading community posts…</p>
        ) : hasPosts ? (
          posts.map((post) => <PublicCommunityRow key={post.id} post={post} />)
        ) : (
          <div className={styles.chatBubbleGroup}>
            <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
              {isPublic
                ? 'No community posts yet. Sign in to start the conversation.'
                : 'To start connecting with the community and accessing support, please sign in.'}
            </div>
          </div>
        )}
      </div>

      <div className={styles.chatSuggestions}>
        <Link href={signInUrl} className={styles.chatSignInLink}>
          Sign In to Get Started
        </Link>
        <p className={styles.chatSuggestionsInfo}>
          {hasPosts
            ? 'You are reading the Commons. Sign in — free — to post, reply, and access housing, work, and safety resources.'
            : 'Skills Economy is free and helps you access housing, work, safety resources, and connect with others in the community.'}
        </p>
      </div>
    </div>
  );
}

// Discord-style full-width row: avatar left, handle + timestamp on top, body below. The faint
// per-author background makes adjacent posts from different members visibly distinct without turning
// the message into a colored blob.
function PublicCommunityRow({ post }: { post: PublicCommunityPost }) {
  const authorLabel = post.authorUsername ? `@${post.authorUsername}` : 'Community member';
  const initial = post.authorUsername ? post.authorUsername.charAt(0).toUpperCase() : 'C';
  return (
    <div
      className={styles.publicChatRow}
      style={{ background: publicRowBackground(post.authorUsername) }}
    >
      <div
        className={styles.chatAvatar}
        style={{ background: publicAvatarBackground(post.authorUsername) }}
        aria-hidden="true"
      >
        {initial}
      </div>
      <div className={styles.publicChatContent}>
        <div className={styles.publicChatMeta}>
          <span className={styles.chatSender}>{authorLabel}</span>
          <span className={styles.publicChatTime}>{formatPostTime(post.createdAtIso)}</span>
        </div>
        <div className={styles.publicChatBody}>{post.body}</div>
      </div>
    </div>
  );
}

// Length cap for a member: admins get the higher cap the API grants them, so the counter never warns
// the owner about a post the server would happily accept.
function maxPostLength(isAdmin: boolean): number {
  return isAdmin ? FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH : FEED_MAX_COMMUNITY_POST_LENGTH;
}

// How many characters an @comic-free post is over the limit (0 for an @comic question, which routes
// to the AI Assistant on its own route with its own limit, so the Commons cap does not apply).
function computeComposerOverBy(mentionsComic: boolean, length: number, maxLength: number): number {
  if (mentionsComic) return 0;
  return Math.max(0, length - maxLength);
}

// Show the character count only in the last stretch before the limit — an always-on counter is noise
// on a two-line message. Hidden entirely for @comic questions.
function computeShowComposerCount(mentionsComic: boolean, length: number, maxLength: number): boolean {
  return !mentionsComic && length > maxLength - 150;
}

// The @-form other members type to mention this member — shown in the mentions empty state.
// feedAuthorHandle already prefixes a set username with '@'; the id pseudonym needs it added.
function mentionLabel(handle: string): string {
  return handle.startsWith('@') ? handle : `@${handle}`;
}

// "X is typing…" line shown above the composer when the live connection is up and someone else is
// typing. One name reads "X is typing…", two read "X and Y are typing…", more collapse to a count.
function computeTypingLabel(typingUsers: HubTypingUser[]): string | null {
  if (typingUsers.length === 0) return null;
  if (typingUsers.length === 1) return `${typingUsers[0].name} is typing…`;
  if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing…`;
  return `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing…`;
}

function selectorForDeepLink(postId: string | null, announcementId: string | null): string | null {
  if (postId) return `[data-post-id="${postId}"]`;
  if (announcementId) return `[data-announcement-id="${announcementId}"]`;
  return null;
}

// Scroll a target element into view and flash it, so the eye lands on it. Shared by the quoted-reply
// jump and the deep-link jump.
function scrollAndFlash(target: HTMLElement): void {
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add(styles.chatBubbleFlash);
  window.setTimeout(() => target.classList.remove(styles.chatBubbleFlash), 1600);
}

// Build the interleaved, time-ordered stream: tag hub messages and comic items with a numeric epoch,
// then sort once so AI cards weave chronologically among community posts. `order` (source index) is a
// stable tiebreaker for equal/absent timestamps. A filtered mode (mentions or announcements) shows
// only the matching messages the server returned; the AI (@comic) cards are local to this member and
// are hidden while any filter is on.
function buildStreamEntries(
  messages: ChatMessage[],
  comicItems: ComicStreamItem[],
  mentionsOnly: boolean,
  announcementsOnly: boolean,
): StreamEntry[] {
  const toEpoch = (iso: string | undefined, fallback: number): number => {
    if (!iso) return fallback;
    const epoch = new Date(iso).getTime();
    return Number.isNaN(epoch) ? fallback : epoch;
  };

  const filterActive = mentionsOnly || announcementsOnly;
  const entries: StreamEntry[] = [
    ...messages.map((message, index): StreamEntry => ({
      kind: 'message',
      message,
      epoch: toEpoch(message.sentAtIso, index),
      order: index,
    })),
    ...(filterActive ? [] : comicItems).map((item, index): StreamEntry => ({
      kind: 'comic',
      item,
      epoch: toEpoch(item.askedAtIso, index),
      order: index,
    })),
  ];

  entries.sort((a, b) => (a.epoch - b.epoch) || (a.order - b.order));
  return entries;
}

// Index of the first stream entry newer than the member's last-seen marker — where the single
// "New messages" divider is drawn. -1 means "nothing new" (no divider).
function computeUnreadDividerIndex(streamEntries: StreamEntry[], lastSeenAtIso: string | null): number {
  if (!lastSeenAtIso) return -1;
  const lastSeenEpoch = new Date(lastSeenAtIso).getTime();
  if (Number.isNaN(lastSeenEpoch)) return -1;
  return streamEntries.findIndex((entry) => entry.epoch > lastSeenEpoch);
}

// The React key for a stream entry, matching the per-branch keys the entries used to carry inline.
function streamEntryKey(entry: StreamEntry): string {
  return entry.kind === 'comic' ? `comic-${entry.item.questionTurnId}` : entry.message.id;
}

function AuthenticatedChatPanel({ currentUser, isAdmin = false }: AuthenticatedChatPanelProps) {
  // A member who hasn't set a username posts under a stable per-user handle
  // (matching the server's feedAuthorHandle and Chyme), so they stay recognizable
  // and accountable across posts instead of blending into a shared label. We nudge
  // them to set a real username below.
  const ownHandle = feedAuthorHandle(currentUser.username, currentUser.userId);
  const needsUsername = !currentUser.username;
  const maxLength = maxPostLength(isAdmin);
  const {
    messages,
    comicItems,
    input,
    setInput,
    notifyTyping,
    typingUsers,
    sendMessage,
    askComic,
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
    isLoading,
    isLive,
    error,
  } = useHomeChat(currentUser);
  // Live length of what is in the composer, measured exactly the way the server measures it: on the
  // whitespace-normalized text, not the raw characters (see lib/feed/normalize.ts). Counting raw
  // characters would tell a member who indents or double-spaces that they are over when they are not.
  const composerLength = useMemo(() => feedPostLength(input), [input]);
  const composerOverBy = computeComposerOverBy(composerMentionsComic, composerLength, maxLength);
  const showComposerCount = computeShowComposerCount(composerMentionsComic, composerLength, maxLength);
  const ownMentionLabel = mentionLabel(ownHandle);
  const typingLabel = useMemo<string | null>(() => computeTypingLabel(typingUsers), [typingUsers]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // The 🔔 notifications center replaces the message stream + composer when open. It is a separate
  // feed (not a filter of the chat), so it is local UI state here rather than in the chat hook.
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Tapping a quoted-reply block jumps to the original message (a common chat behavior): find the
  // rendered bubble with that community post id, scroll it into view, and flash a highlight. No-op
  // when the quoted post is not in the loaded window (older than the recent page) — the snippet in
  // the quote block already shows what was said.
  const jumpToQuotedPost = useCallback((postId: string | null) => {
    if (!postId) return;
    const target = messagesContainerRef.current?.querySelector<HTMLElement>(`[data-post-id="${postId}"]`);
    if (target) scrollAndFlash(target);
  }, []);

  // Scroll a deep-link target (a post bubble or announcement card) into view and flash it. The target
  // streams in asynchronously (the recent page, plus the "load around" window for an older one), so it
  // retries for ~12s, then gives up quietly if the target is genuinely gone. Clears the query param on
  // success so a refresh or Back does not re-jump. Returns a canceller for effect cleanup.
  const flashTarget = useCallback((selector: string) => {
    let attempts = 0;
    let timer = 0;
    const tryScroll = () => {
      const target = messagesContainerRef.current?.querySelector<HTMLElement>(selector);
      if (target) {
        scrollAndFlash(target);
        if (window.location.search) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        timer = window.setTimeout(tryScroll, 300);
      }
    };
    tryScroll();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Cold entry via URL (a fresh page load / device-push tap opening /?post=<id> or /?announcement=<id>):
  // show the stream and jump to the target. The chat hook has already pulled the target's window on
  // bootstrap. Runs once on mount — an in-app tap from the panel is handled by handleNotificationOpen,
  // because a client-side navigation to the same route does not remount this component.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const selector = selectorForDeepLink(params.get('post'), params.get('announcement'));
    if (!selector) return;
    setNotificationsOpen(false);
    return flashTarget(selector);
  }, [flashTarget]);

  // In-app "Open" from the notifications panel. A notification links to /?post=<id> or
  // /?announcement=<id>, but that is the same route the Commons already sits on, so a client-side
  // navigation would not remount the shell and the mount effect above would never fire — the reported
  // "nothing happens" bug. So intercept the click here: leave the panel, force the unfiltered stream,
  // pull the target's window, and scroll+flash it. Returns true when handled (the caller then blocks
  // the default navigation); returns false for a non-Commons link (e.g. /apps/<plugin>), which
  // navigates normally.
  const handleNotificationOpen = useCallback(
    (linkPath: string): boolean => {
      if (typeof window === 'undefined') return false;
      let url: URL;
      try {
        url = new URL(linkPath, window.location.origin);
      } catch {
        return false;
      }
      if (url.pathname !== '/') return false;
      const postId = url.searchParams.get('post');
      const announcementId = url.searchParams.get('announcement');
      const selector = selectorForDeepLink(postId, announcementId);
      if (!selector) return false;
      setNotificationsOpen(false);
      showAllStream();
      window.history.replaceState(null, '', linkPath);
      void loadAround(postId, announcementId).catch(() => undefined);
      flashTarget(selector);
      return true;
    },
    [flashTarget, loadAround, showAllStream],
  );

  // Auto-grow the composer as the member types multiple lines (capped, then it scrolls). Runs on
  // every input change — including the reset to '' after a send, which shrinks it back to one line.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // The asker's own questions show their display name; this hub only renders the current user's
  // @comic items (server-scoped).
  const streamEntries = useMemo<StreamEntry[]>(() => buildStreamEntries(messages, comicItems, mentionsOnly, announcementsOnly), [messages, comicItems, mentionsOnly, announcementsOnly]);

  const hasContent = streamEntries.length > 0;

  // The last-seen marker is frozen for the life of this mount (captured once on entry) so the divider
  // does not creep down as the member reads or as best-effort "mark seen" runs.
  const unreadDividerIndex = useMemo<number>(() => computeUnreadDividerIndex(streamEntries, lastSeenAtIso), [streamEntries, lastSeenAtIso]);

  // Auto-scroll the chat to the latest entry when the stream grows (a sent message, a concierge
  // reply, or new polled history), so members always land on what they saw last — like a normal chat.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [streamEntries.length]);

  // Once the chat has content on screen, mark the channel as seen (best-effort, once per mount)
  // so the next visit's "New messages" divider reflects where the member left off.
  useEffect(() => {
    if (hasContent) {
      markSeen();
    }
  }, [hasContent, markSeen]);

  return (
    <div className={styles.chatPanelWrap}>
      {error ? (
        <section className={styles.usernameAlert} role="status">
          {error}
        </section>
      ) : null}

      {needsUsername ? (
        <section className={styles.usernameAlert} role="status">
          You&apos;re posting as <strong>{ownHandle}</strong>. To pick a username members recognize, click the person icon at the top right, then <strong>Manage account</strong> — you can edit your username there.
        </section>
      ) : null}

      {notificationsOpen ? (
        <NotificationsPanel onOpenDeepLink={handleNotificationOpen} />
      ) : (
        <MessageStream
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          inputRef={inputRef}
          isLoading={isLoading}
          isFilterRefreshing={isFilterRefreshing}
          hasContent={hasContent}
          mentionsOnly={mentionsOnly}
          announcementsOnly={announcementsOnly}
          ownMentionLabel={ownMentionLabel}
          ownHandle={ownHandle}
          currentUser={currentUser}
          streamEntries={streamEntries}
          unreadDividerIndex={unreadDividerIndex}
          onRate={rateComicAnswer}
          onToggleAnnouncementReaction={toggleAnnouncementReaction}
          onJumpToQuoted={jumpToQuotedPost}
          onBeginReply={beginReply}
          onEdit={editMessage}
          onDelete={deleteMessage}
          onToggleReaction={toggleReaction}
        />
      )}

      <ConciergeChipRail
        mentionsOnly={mentionsOnly}
        announcementsOnly={announcementsOnly}
        notificationsOpen={notificationsOpen}
        chips={suggestionChips}
        onToggleMentions={() => { setNotificationsOpen(false); toggleMentionsOnly(); }}
        onToggleAnnouncements={() => { setNotificationsOpen(false); toggleAnnouncementsOnly(); }}
        onToggleNotifications={() => setNotificationsOpen((open) => !open)}
        onAsk={askComic}
      />

      {/* Composer + helpers hide while the notifications center is open — you read notifications
          there, you don't post into them. The chip row above stays so 🔔 can toggle back. */}
      {notificationsOpen ? null : (
        <ChatComposer
          input={input}
          setInput={setInput}
          notifyTyping={notifyTyping}
          inputRef={inputRef}
          replyTarget={replyTarget}
          onCancelReply={cancelReply}
          typingLabel={typingLabel}
          composerMentionsComic={composerMentionsComic}
          composerOverBy={composerOverBy}
          isSending={isSending}
          onSend={sendMessage}
          showComposerCount={showComposerCount}
          composerLength={composerLength}
          maxLength={maxLength}
          isLive={isLive}
        />
      )}

      <ComicConsentModal open={consentModalOpen} onConfirm={() => void confirmConsent()} onDismiss={dismissConsent} />
    </div>
  );
}

type StreamCallbacks = {
  onRate: (turnId: string, rating: ComicAnswerRating) => void;
  onToggleAnnouncementReaction: (announcementId: string, emoji: string) => void;
  onJumpToQuoted: (postId: string | null) => void;
  onBeginReply: (message: ChatMessage) => void;
  onEdit: (postId: string, text: string) => void;
  onDelete: (postId: string) => void;
  onToggleReaction: (postId: string, emoji: string) => void;
};

type MessageStreamProps = StreamCallbacks & {
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isLoading: boolean;
  isFilterRefreshing: boolean;
  hasContent: boolean;
  mentionsOnly: boolean;
  announcementsOnly: boolean;
  ownMentionLabel: string;
  ownHandle: string;
  currentUser: ShellCurrentUser;
  streamEntries: StreamEntry[];
  unreadDividerIndex: number;
};

function MessageStream({
  messagesContainerRef,
  messagesEndRef,
  inputRef,
  isLoading,
  isFilterRefreshing,
  hasContent,
  mentionsOnly,
  announcementsOnly,
  ownMentionLabel,
  ownHandle,
  currentUser,
  streamEntries,
  unreadDividerIndex,
  ...callbacks
}: MessageStreamProps) {
  return (
    <div className={styles.chatMessages} ref={messagesContainerRef}>
      {(isLoading || isFilterRefreshing) && !hasContent ? (
        <StreamLoadingFootnote mentionsOnly={mentionsOnly} announcementsOnly={announcementsOnly} />
      ) : null}

      {!isLoading && !isFilterRefreshing && !hasContent ? (
        <StreamEmptyState mentionsOnly={mentionsOnly} announcementsOnly={announcementsOnly} ownMentionLabel={ownMentionLabel} />
      ) : null}

      {streamEntries.map((entry, index) => (
        <StreamEntryView
          key={streamEntryKey(entry)}
          entry={entry}
          showDivider={index === unreadDividerIndex}
          ownHandle={ownHandle}
          currentUser={currentUser}
          inputRef={inputRef}
          {...callbacks}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

function StreamLoadingFootnote({ mentionsOnly, announcementsOnly }: { mentionsOnly: boolean; announcementsOnly: boolean }) {
  const text = mentionsOnly ? 'Looking for your mentions…' : announcementsOnly ? 'Loading announcements…' : 'Loading live messages…';
  return <p className={styles.chatFootnote}>{text}</p>;
}

function StreamEmptyState({ mentionsOnly, announcementsOnly, ownMentionLabel }: { mentionsOnly: boolean; announcementsOnly: boolean; ownMentionLabel: string }) {
  return (
    <div className={styles.chatBubbleGroup}>
      <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
        {mentionsOnly ? (
          <>No mentions yet. When someone writes <strong>{ownMentionLabel}</strong>, it shows here.</>
        ) : announcementsOnly ? (
          <>No announcements yet. Official updates from the team show here.</>
        ) : (
          <>You are connected. Share with the community, or type <strong>@comic</strong> to ask the AI Assistant.</>
        )}
      </div>
    </div>
  );
}

// A single "New messages" divider sits immediately before the first entry newer than the member's
// last-seen marker. Rendered ahead of whichever entry follows it.
function UnreadDivider() {
  return (
    <div className={styles.unreadDivider} role="separator" aria-label="New messages">
      <span className={styles.unreadDividerLabel}>New messages</span>
    </div>
  );
}

type StreamEntryViewProps = StreamCallbacks & {
  entry: StreamEntry;
  showDivider: boolean;
  ownHandle: string;
  currentUser: ShellCurrentUser;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

function StreamEntryView({ entry, showDivider, ownHandle, currentUser, inputRef, ...callbacks }: StreamEntryViewProps) {
  const divider = showDivider ? <UnreadDivider key="unread-divider" /> : null;

  if (entry.kind === 'comic') {
    return <ComicEntry item={entry.item} askedByLabel={currentUser.displayName} divider={divider} onRate={callbacks.onRate} />;
  }

  const msg = entry.message;
  // The author shown above the bubble. Your own messages are attributed to you (handle when we have
  // it) so every message has a visible author, not just other people's — peer posts were rendering
  // with no name on the sender's own side.
  const senderName = msg.from === 'user' ? ownHandle : (msg.senderLabel ?? 'Survivor Hub');

  // An official announcement renders as its own distinct card (badge + optional title), not a chat
  // bubble, so it stands apart from peer posts and AI answers.
  if (msg.kind === 'announcement') {
    return (
      <AnnouncementEntry
        msg={msg}
        senderName={senderName}
        divider={divider}
        onToggleReaction={callbacks.onToggleAnnouncementReaction}
      />
    );
  }

  return (
    <PeerMessageEntry
      msg={msg}
      senderName={senderName}
      divider={divider}
      inputRef={inputRef}
      onJumpToQuoted={callbacks.onJumpToQuoted}
      onBeginReply={callbacks.onBeginReply}
      onEdit={callbacks.onEdit}
      onDelete={callbacks.onDelete}
      onToggleReaction={callbacks.onToggleReaction}
    />
  );
}

function ComicEntry({
  item,
  askedByLabel,
  divider,
  onRate,
}: {
  item: ComicStreamItem;
  askedByLabel: string;
  divider: ReactNode;
  onRate: (turnId: string, rating: ComicAnswerRating) => void;
}) {
  if (item.status === 'answered') {
    return (
      <>
        {divider}
        <ComicAnswerCard item={item} askedByLabel={askedByLabel} onRate={onRate} />
      </>
    );
  }
  return (
    <>
      {divider}
      <ComicPendingCard item={item} askedByLabel={askedByLabel} />
    </>
  );
}

function AnnouncementEntry({
  msg,
  senderName,
  divider,
  onToggleReaction,
}: {
  msg: ChatMessage;
  senderName: string;
  divider: ReactNode;
  onToggleReaction: (announcementId: string, emoji: string) => void;
}) {
  return (
    <>
      {divider}
      <AnnouncementCard
        senderName={senderName}
        title={msg.announcementTitle ?? null}
        body={msg.text}
        time={msg.time}
        linkedPlugins={msg.linkedPlugins ?? []}
        announcementId={msg.announcementId ?? null}
        reactions={msg.reactions}
        replyCount={msg.replyCount}
        onToggleReaction={(id, emoji) => void onToggleReaction(id, emoji)}
      />
    </>
  );
}

type PeerMessageEntryProps = {
  msg: ChatMessage;
  senderName: string;
  divider: ReactNode;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onJumpToQuoted: (postId: string | null) => void;
  onBeginReply: (message: ChatMessage) => void;
  onEdit: (postId: string, text: string) => void;
  onDelete: (postId: string) => void;
  onToggleReaction: (postId: string, emoji: string) => void;
};

function PeerMessageEntry({ msg, senderName, divider, inputRef, onJumpToQuoted, onBeginReply, onEdit, onDelete, onToggleReaction }: PeerMessageEntryProps) {
  return (
    <>
      {divider}
      <div className={msg.from === 'user' ? `${styles.chatRow} ${styles.chatRowUser}` : styles.chatRow}>
        {msg.from === 'hub' ? <div className={styles.chatAvatar} aria-hidden="true">{avatarFromSender(senderName)}</div> : null}
        <div className={styles.chatBubbleGroup} data-post-id={msg.communityPostId ?? undefined}>
          <span className={msg.from === 'user' ? `${styles.chatSender} ${styles.chatSenderUser}` : styles.chatSender}>{senderName}</span>
          <QuotedBlock quoted={msg.quotedMessage} onJump={onJumpToQuoted} />
          <div className={msg.from === 'user' ? `${styles.chatBubble} ${styles.chatBubbleUser}` : `${styles.chatBubble} ${styles.chatBubbleHub}`}>
            {msg.text}
          </div>
          {msg.actionLabel && msg.actionSlug ? (
            <Link href={`/apps/${msg.actionSlug}`} className={styles.chatActionBtn}>
              {msg.actionLabel}
            </Link>
          ) : null}
          <MessageMetaRow msg={msg} senderName={senderName} inputRef={inputRef} onBeginReply={onBeginReply} onEdit={onEdit} onDelete={onDelete} />
          {msg.communityPostId ? (
            <ChatReactionRow
              postId={msg.communityPostId}
              reactions={msg.reactions}
              onToggle={(postId, emoji) => void onToggleReaction(postId, emoji)}
              // A member may only react to posts they did not author. On the member's own post the row
              // is read-only: it shows others' reactions but offers no way to add.
              readOnly={msg.from === 'user'}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

// The quoted block above a Signal-style reply. When the quoted post is still in the loaded window it
// renders as a button that jumps to the original; otherwise a plain block (the snippet is enough).
function QuotedBlock({ quoted, onJump }: { quoted: ChatQuotedMessage | null | undefined; onJump: (postId: string | null) => void }) {
  if (!quoted) return null;
  if (quoted.postId) {
    return (
      <button
        type="button"
        className={`${styles.chatQuotedBlock} ${styles.chatQuotedBlockClickable}`}
        onClick={() => onJump(quoted.postId)}
        aria-label={`Go to the message from ${quoted.author} that this replies to`}
      >
        <span className={styles.chatQuotedAuthor}>{quoted.author}</span>
        <span className={styles.chatQuotedSnippet}>{quoted.snippet}</span>
      </button>
    );
  }
  return (
    <div className={styles.chatQuotedBlock}>
      <span className={styles.chatQuotedAuthor}>{quoted.author}</span>
      <span className={styles.chatQuotedSnippet}>{quoted.snippet}</span>
    </div>
  );
}

function MessageMetaRow({
  msg,
  senderName,
  inputRef,
  onBeginReply,
  onEdit,
  onDelete,
}: {
  msg: ChatMessage;
  senderName: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onBeginReply: (message: ChatMessage) => void;
  onEdit: (postId: string, text: string) => void;
  onDelete: (postId: string) => void;
}) {
  // A peer post (it carries a community post id) can be replied to Signal-style.
  const canReply = Boolean(msg.communityPostId);
  // The member can delete their own peer post (there is no edit — delete and repost instead).
  const canDelete = msg.from === 'user' && Boolean(msg.communityPostId);
  return (
    <div className={msg.from === 'user' ? `${styles.chatMetaRow} ${styles.chatMetaRowUser}` : styles.chatMetaRow}>
      <span className={msg.from === 'user' ? `${styles.chatTime} ${styles.chatTimeUser}` : styles.chatTime}>
        {msg.time}
      </span>
      {canReply ? (
        <button
          type="button"
          className={styles.chatReplyBtn}
          onClick={() => onBeginReply(msg)}
          aria-label={`Reply to ${senderName}`}
        >
          <Reply size={12} /> Reply
        </button>
      ) : null}
      {canDelete && msg.communityPostId ? (
        <button
          type="button"
          className={styles.chatEditBtn}
          onClick={() => {
            // Editing is delete + repost: pull the text back into the composer, delete the original,
            // and focus the box so the member fixes it and sends a fresh post.
            onEdit(msg.communityPostId as string, msg.text);
            inputRef.current?.focus();
          }}
          aria-label="Edit your post"
        >
          <Pencil size={12} /> Edit
        </button>
      ) : null}
      {canDelete && msg.communityPostId ? (
        <button
          type="button"
          className={styles.chatDeleteBtn}
          onClick={() => {
            if (window.confirm('Delete this post? This cannot be undone. To change it, delete and post again.')) {
              void onDelete(msg.communityPostId as string);
            }
          }}
          aria-label="Delete your post"
        >
          <Trash2 size={12} /> Delete
        </button>
      ) : null}
    </div>
  );
}

type ConciergeChipRailProps = {
  mentionsOnly: boolean;
  announcementsOnly: boolean;
  notificationsOpen: boolean;
  chips: HubSuggestionChip[];
  onToggleMentions: () => void;
  onToggleAnnouncements: () => void;
  onToggleNotifications: () => void;
  onAsk: (question: string) => void;
};

// One-tap suggestion chips (#471) — persistent (shown whether or not the chat already has messages),
// so a member can always tap one. Each chip does the right thing on a single tap, never just a
// composer pre-fill: a NAVIGATE chip opens that plugin directly (it is an action, not a question), and
// an ASK chip routes the question to the @comic AI assistant. The "@ Mentions" filter chip leads this
// row at every width (owner directive, 2026-07-17); same pill size as the suggestion chips, sky-blue
// so it stays visually distinct; it scrolls with the row. The rail always renders because the chips
// are always present.
function ConciergeChipRail({
  mentionsOnly,
  announcementsOnly,
  notificationsOpen,
  chips,
  onToggleMentions,
  onToggleAnnouncements,
  onToggleNotifications,
  onAsk,
}: ConciergeChipRailProps) {
  return (
    <div className={styles.conciergeChipRail} role="group" aria-label="Ask what you need">
      <MentionsFilterButton active={mentionsOnly && !notificationsOpen} on={mentionsOnly} onClick={onToggleMentions} />
      <AnnouncementsFilterButton active={announcementsOnly && !notificationsOpen} on={announcementsOnly} onClick={onToggleAnnouncements} />
      <NotificationsFilterButton open={notificationsOpen} onClick={onToggleNotifications} />
      {notificationsOpen ? null : <SuggestionChips chips={chips} onAsk={onAsk} />}
    </div>
  );
}

// Mentions filter — icon-only "@" chip (the word was dropped to match the 📣 chip), so the two stream
// filters read as a matched pair of small glyph pills. `active` drives the styling (off while the
// notifications center is open); `on` drives the label (the raw filter state).
function MentionsFilterButton({ active, on, onClick }: { active: boolean; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={active ? `${styles.mentionsFilterBtn} ${styles.mentionsFilterBtnActive}` : styles.mentionsFilterBtn}
      onClick={onClick}
      aria-pressed={active}
      aria-label={on ? 'Show all messages' : 'Show only messages that mention you'}
      title={on ? 'Show all messages' : 'Show only messages that mention you'}
    >
      <AtSign size={15} aria-hidden="true" />
    </button>
  );
}

// Announcements filter — "Announcements" is too long for a chip, so it shows the 📣 emoji alone.
// Filtering to announcements lets a member with limited message history still surface official updates
// that scrolled off the recent page.
function AnnouncementsFilterButton({ active, on, onClick }: { active: boolean; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={active ? `${styles.announcementsFilterBtn} ${styles.announcementsFilterBtnActive}` : styles.announcementsFilterBtn}
      onClick={onClick}
      aria-pressed={active}
      aria-label={on ? 'Show all messages' : 'Show only announcements'}
      title={on ? 'Show all messages' : 'Show only announcements'}
    >
      <span aria-hidden="true">📣</span>
    </button>
  );
}

// Notifications center — the 🔔 chip opens the member's cross-plugin notifications feed in place of the
// chat stream (a separate view, not a filter). Styled like the filter chips so the three read as a row
// of glyph pills.
function NotificationsFilterButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={open ? `${styles.notificationsFilterBtn} ${styles.notificationsFilterBtnActive}` : styles.notificationsFilterBtn}
      onClick={onClick}
      aria-pressed={open}
      aria-label={open ? 'Back to the conversation' : 'Show your notifications'}
      title={open ? 'Back to the conversation' : 'Show your notifications'}
    >
      <span aria-hidden="true">🔔</span>
    </button>
  );
}

function SuggestionChips({ chips, onAsk }: { chips: HubSuggestionChip[]; onAsk: (question: string) => void }) {
  return (
    <>
      {chips.map((chip) =>
        chip.kind === 'navigate' ? (
          <Link key={chip.id} href={`/apps/${chip.slug}`} className={styles.conciergeChip} title={chip.label}>
            {chip.label}
          </Link>
        ) : (
          <button key={chip.id} type="button" className={styles.conciergeChip} title={chip.label} onClick={() => onAsk(chip.question)}>
            {chip.label}
          </button>
        ),
      )}
    </>
  );
}

type ChatComposerProps = {
  input: string;
  setInput: (value: string) => void;
  notifyTyping: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  replyTarget: ReplyTarget | null;
  onCancelReply: () => void;
  typingLabel: string | null;
  composerMentionsComic: boolean;
  composerOverBy: number;
  isSending: boolean;
  onSend: () => void;
  showComposerCount: boolean;
  composerLength: number;
  maxLength: number;
  isLive: boolean;
};

function ChatComposer({
  input,
  setInput,
  notifyTyping,
  inputRef,
  replyTarget,
  onCancelReply,
  typingLabel,
  composerMentionsComic,
  composerOverBy,
  isSending,
  onSend,
  showComposerCount,
  composerLength,
  maxLength,
  isLive,
}: ChatComposerProps) {
  return (
    <>
      {/* @comic mention affordance + helper copy (per the locked design / naming rules). On phones
          the standalone "@comic" chip duplicated the "@comic" in the helper text, so the chip is
          dropped and the line is relabeled to name the assistant and its human-in-the-loop review. */}
      <div className={styles.comicComposerHelper}>
        <span className={styles.comicComposerHelperText}>
          AI Assistant (human in the loop) — type <span className={styles.comicComposerHelperToken}>@comic</span> to ask
        </span>
      </div>

      {/* "Replying to …" banner: shows a one-line quote preview and a cancel (X). Sending while this
          is set posts the message as a Signal-style reply to that peer post. */}
      {replyTarget ? <ReplyBanner replyTarget={replyTarget} onCancel={onCancelReply} /> : null}

      {/* Subtle "X is typing…" line, only when the live connection surfaces someone typing. Kept on
          one quiet line above the composer so it sits with the existing dark design. */}
      {typingLabel ? <TypingIndicator label={typingLabel} /> : null}

      <div className={styles.chatInputWrap}>
        <label className={styles.visuallyHidden} htmlFor="chat-input">Share with the community, or type @comic to ask the AI Assistant</label>
        <textarea
          ref={inputRef}
          id="chat-input"
          className={styles.chatInput}
          placeholder="Share with the community, or type @comic to ask…"
          rows={1}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            // Emit a typing event on the live channel (no-op in polling-only mode).
            notifyTyping();
          }}
          // Enter never sends — it inserts a line break so members can write spaced-out paragraphs
          // (owner request 2026-07-20). Sending is only via the ➤ button. There is deliberately no
          // onKeyDown send handler here; do not restore Enter-to-send.
        />
        <button
          type="button"
          className={input.trim() && composerOverBy === 0 ? `${styles.chatSendBtn} ${styles.chatSendBtnActive}` : styles.chatSendBtn}
          onClick={() => {
            void onSend();
          }}
          aria-label={composerMentionsComic ? 'Ask the AI Assistant' : 'Send message'}
          // Blocked while over the limit: the server would reject it anyway, and a rejection the
          // member can see before pressing send beats one they discover afterwards.
          disabled={isSending || composerOverBy > 0}
        >
          ➤
        </button>
      </div>

      {/* Character count, shown only near and past the limit. */}
      {showComposerCount ? <ComposerCharacterCount composerOverBy={composerOverBy} charsLeft={maxLength - composerLength} /> : null}

      <p className={styles.chatFootnote}>
        {isLive ? 'Human-in-the-loop AI support and community support channel.' : 'Support channel keeps syncing as new messages arrive.'}{' '}
        <a href="/guidelines" style={{ color: 'inherit', textDecoration: 'underline' }}>Community guidelines</a>
      </p>
    </>
  );
}

function ReplyBanner({ replyTarget, onCancel }: { replyTarget: ReplyTarget; onCancel: () => void }) {
  return (
    <div className={styles.composerReplyBanner}>
      <div className={styles.composerReplyPreview}>
        <span className={styles.composerReplyLabel}>Replying to {replyTarget.quote.author}</span>
        <span className={styles.composerReplySnippet}>{replyTarget.quote.snippet}</span>
      </div>
      <button
        type="button"
        className={styles.composerReplyCancel}
        onClick={onCancel}
        aria-label="Cancel reply"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className={styles.typingIndicator} role="status" aria-live="polite">
      <span className={styles.typingDots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {label}
    </div>
  );
}

// Over the limit it names the exact number to remove, which is the number a member actually needs —
// "1,318 / 1,200" makes them do the subtraction themselves. aria-live is polite so it does not
// interrupt typing, and the announcement is throttled by only rendering in the last stretch.
function ComposerCharacterCount({ composerOverBy, charsLeft }: { composerOverBy: number; charsLeft: number }) {
  return (
    <p
      className={styles.chatFootnote}
      role="status"
      aria-live="polite"
      style={{ color: composerOverBy > 0 ? '#F87171' : undefined, marginTop: 6, marginBottom: 0 }}
    >
      {composerOverBy > 0
        ? `${composerOverBy.toLocaleString()} character${composerOverBy === 1 ? '' : 's'} over the limit — remove ${composerOverBy === 1 ? 'it' : 'that many'} to post. Or split this into two messages.`
        : `${charsLeft.toLocaleString()} character${charsLeft === 1 ? '' : 's'} left.`}
    </p>
  );
}
