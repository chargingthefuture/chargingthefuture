'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AtSign, Reply, Trash2, X } from 'lucide-react';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { PublicCommunityPost } from '../../lib/feed/types';
import { feedAuthorHandle } from '../../lib/feed/author-handle';
import type { ChatMessage, ComicStreamItem, ShellCurrentUser, ShellStats } from './shell-types';
import { useHomeChat } from './use-home-chat';
import { ComicAnswerCard, ComicPendingCard } from './comic-cards';
import { AnnouncementCard } from './announcement-card';
import { NotificationsPanel } from './notifications-panel';
import { ChatReactionRow } from './chat-reaction-row';
import { ComicConsentModal } from './comic-consent-modal';
import styles from './community-shell.module.css';

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
};

type ShellChatPanelProps = {
  stats: ShellStats;
  plugins: PluginRegistryItem[];
  currentUser: ShellCurrentUser;
  isAuthenticated?: boolean;
  signInUrl?: string;
};

export function ShellChatPanel({ stats, plugins, currentUser, isAuthenticated = false, signInUrl = '/sign-in' }: ShellChatPanelProps) {
  if (isAuthenticated) {
    return <AuthenticatedChatPanel stats={stats} plugins={plugins} currentUser={currentUser} />;
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
          <h1 className={styles.heroBannerTitle}>Welcome to Survivor Hub</h1>
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
          posts.map((post) => {
            const authorLabel = post.authorUsername ? `@${post.authorUsername}` : 'Community member';
            const initial = post.authorUsername ? post.authorUsername.charAt(0).toUpperCase() : 'C';
            return (
              // Discord-style full-width row: avatar left, handle + timestamp on top, body below.
              // The faint per-author background makes adjacent posts from different members
              // visibly distinct without turning the message into a colored blob.
              <div
                key={post.id}
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
          })
        ) : (
          <div className={styles.chatBubbleGroup}>
            <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
              {isPublic
                ? 'No community posts yet. Sign in to start the conversation.'
                : 'To start connecting with Survivor Hub and accessing community support, please sign in.'}
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
            ? 'You are reading the community. Sign in — free — to post, reply, and access housing, work, and safety resources.'
            : 'Survivor Hub is free and helps you access housing, work, safety resources, and connect with others in the community.'}
        </p>
      </div>
    </div>
  );
}

function AuthenticatedChatPanel({ currentUser }: AuthenticatedChatPanelProps) {
  // A member who hasn't set a username posts under a stable per-user handle
  // (matching the server's feedAuthorHandle and Chyme), so they stay recognizable
  // and accountable across posts instead of blending into a shared label. We nudge
  // them to set a real username below.
  const ownHandle = feedAuthorHandle(currentUser.username, currentUser.userId);
  const needsUsername = !currentUser.username;
  const {
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
    isLoading,
    isLive,
    error,
  } = useHomeChat(currentUser);
  // The @-form other members type to mention this member — shown in the mentions empty state.
  // feedAuthorHandle already prefixes a set username with '@'; the id pseudonym needs it added.
  const ownMentionLabel = ownHandle.startsWith('@') ? ownHandle : `@${ownHandle}`;
  // "X is typing…" line shown above the composer when the live connection is up and someone else is
  // typing. One name reads "X is typing…", two read "X and Y are typing…", more collapse to a count.
  const typingLabel = useMemo<string | null>(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing…`;
    if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing…`;
    return `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing…`;
  }, [typingUsers]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // The 🔔 notifications center replaces the message stream + composer when open. It is a separate
  // feed (not a filter of the chat), so it is local UI state here rather than in the chat hook.
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Tapping a quoted-reply block jumps to the original message (a common chat behavior): find the
  // rendered bubble with that community post id, scroll it into view, and flash a highlight so the
  // eye lands on it. No-op when the quoted post is not in the loaded window (older than the recent
  // page) — the snippet in the quote block already shows what was said.
  const jumpToQuotedPost = useCallback((postId: string | null) => {
    if (!postId) return;
    const container = messagesContainerRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-post-id="${postId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add(styles.chatBubbleFlash);
    window.setTimeout(() => target.classList.remove(styles.chatBubbleFlash), 1600);
  }, []);

  // Scroll a deep-link target (a post bubble or announcement card) into view and flash it. The target
  // streams in asynchronously (the recent page, plus the "load around" window for an older one), so it
  // retries for ~12s, then gives up quietly if the target is genuinely gone. Clears the query param on
  // success so a refresh or Back does not re-jump. Returns a canceller for effect cleanup.
  const flashTarget = useCallback((selector: string) => {
    let attempts = 0;
    let timer = 0;
    const tryScroll = () => {
      const container = messagesContainerRef.current;
      const target = container?.querySelector<HTMLElement>(selector);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add(styles.chatBubbleFlash);
        window.setTimeout(() => target.classList.remove(styles.chatBubbleFlash), 1600);
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

  const selectorForDeepLink = (postId: string | null, announcementId: string | null): string | null =>
    postId
      ? `[data-post-id="${postId}"]`
      : announcementId
        ? `[data-announcement-id="${announcementId}"]`
        : null;

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

  // Build the interleaved, time-ordered stream: tag hub messages and comic items with a numeric
  // epoch, then sort once so AI cards weave chronologically among community posts. `order` (source
  // index) is a stable tiebreaker for equal/absent timestamps. The asker's own questions show their
  // display name; this hub only renders the current user's @comic items (server-scoped).
  const streamEntries = useMemo<StreamEntry[]>(() => {
    const toEpoch = (iso: string | undefined, fallback: number): number => {
      if (!iso) return fallback;
      const epoch = new Date(iso).getTime();
      return Number.isNaN(epoch) ? fallback : epoch;
    };

    // A filtered mode (mentions or announcements) shows only the matching messages the server
    // returned; the AI (@comic) cards are local to this member and are hidden while any filter is on.
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
  }, [messages, comicItems, mentionsOnly, announcementsOnly]);

  const hasContent = streamEntries.length > 0;

  // Index of the first stream entry newer than the member's last-seen marker — where the single
  // "New messages" divider is drawn. -1 means "nothing new" (no divider). The marker is frozen
  // for the life of this mount (captured once on entry) so the divider does not creep down as the
  // member reads or as best-effort "mark seen" runs.
  const unreadDividerIndex = useMemo<number>(() => {
    if (!lastSeenAtIso) return -1;
    const lastSeenEpoch = new Date(lastSeenAtIso).getTime();
    if (Number.isNaN(lastSeenEpoch)) return -1;
    return streamEntries.findIndex((entry) => entry.epoch > lastSeenEpoch);
  }, [streamEntries, lastSeenAtIso]);

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
          You&apos;re posting as <strong>{ownHandle}</strong>. Open your account menu (your profile picture) and set a username so members recognize you.
        </section>
      ) : null}

      {notificationsOpen ? (
        <NotificationsPanel onOpenDeepLink={handleNotificationOpen} />
      ) : (
      <div className={styles.chatMessages} ref={messagesContainerRef}>
        {(isLoading || isFilterRefreshing) && !hasContent ? (
          <p className={styles.chatFootnote}>
            {mentionsOnly ? 'Looking for your mentions…' : announcementsOnly ? 'Loading announcements…' : 'Loading live messages…'}
          </p>
        ) : null}

        {!isLoading && !isFilterRefreshing && !hasContent ? (
          <div className={styles.chatBubbleGroup}>
            <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
              {mentionsOnly ? (
                <>No mentions yet. When someone writes <strong>{ownMentionLabel}</strong>, it shows here.</>
              ) : announcementsOnly ? (
                <>No announcements yet. Official updates from the team show here.</>
              ) : (
                <>Survivor Hub is live. Share with the community, or type <strong>@comic</strong> to ask the AI Assistant.</>
              )}
            </div>
          </div>
        ) : null}

        {streamEntries.map((entry, index) => {
          // A single "New messages" divider sits immediately before the first entry newer than
          // the member's last-seen marker. Rendered ahead of whichever entry follows it.
          const divider = index === unreadDividerIndex ? (
            <div key="unread-divider" className={styles.unreadDivider} role="separator" aria-label="New messages">
              <span className={styles.unreadDividerLabel}>New messages</span>
            </div>
          ) : null;

          if (entry.kind === 'comic') {
            const { item } = entry;
            if (item.status === 'answered') {
              return (
                <Fragment key={`comic-${item.questionTurnId}`}>
                  {divider}
                  <ComicAnswerCard
                    item={item}
                    askedByLabel={currentUser.displayName}
                    onRate={rateComicAnswer}
                  />
                </Fragment>
              );
            }
            return (
              <Fragment key={`comic-${item.questionTurnId}`}>
                {divider}
                <ComicPendingCard
                  item={item}
                  askedByLabel={currentUser.displayName}
                />
              </Fragment>
            );
          }

          const msg = entry.message;
          // The author shown above the bubble. Your own messages are attributed to you (handle when
          // we have it) so every message has a visible author, not just other people's — peer posts
          // were rendering with no name on the sender's own side.
          const ownLabel = ownHandle;
          const senderName = msg.from === 'user' ? ownLabel : (msg.senderLabel ?? 'Survivor Hub');

          // An official announcement renders as its own distinct card (badge + optional title),
          // not a chat bubble, so it stands apart from peer posts and AI answers.
          if (msg.kind === 'announcement') {
            return (
              <Fragment key={msg.id}>
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
                  onToggleReaction={(id, emoji) => void toggleAnnouncementReaction(id, emoji)}
                />
              </Fragment>
            );
          }

          // A peer post (it carries a community post id) can be replied to Signal-style.
          const canReply = Boolean(msg.communityPostId);
          // The member can delete their own peer post (there is no edit — delete and repost instead).
          const canDelete = msg.from === 'user' && Boolean(msg.communityPostId);
          return (
            <Fragment key={msg.id}>
              {divider}
              <div
                className={msg.from === 'user' ? `${styles.chatRow} ${styles.chatRowUser}` : styles.chatRow}
              >
                {msg.from === 'hub' ? <div className={styles.chatAvatar} aria-hidden="true">{avatarFromSender(senderName)}</div> : null}
                <div className={styles.chatBubbleGroup} data-post-id={msg.communityPostId ?? undefined}>
                  <span className={msg.from === 'user' ? `${styles.chatSender} ${styles.chatSenderUser}` : styles.chatSender}>{senderName}</span>
                  {msg.quotedMessage ? (
                    msg.quotedMessage.postId ? (
                      <button
                        type="button"
                        className={`${styles.chatQuotedBlock} ${styles.chatQuotedBlockClickable}`}
                        onClick={() => jumpToQuotedPost(msg.quotedMessage?.postId ?? null)}
                        aria-label={`Go to the message from ${msg.quotedMessage.author} that this replies to`}
                      >
                        <span className={styles.chatQuotedAuthor}>{msg.quotedMessage.author}</span>
                        <span className={styles.chatQuotedSnippet}>{msg.quotedMessage.snippet}</span>
                      </button>
                    ) : (
                      <div className={styles.chatQuotedBlock}>
                        <span className={styles.chatQuotedAuthor}>{msg.quotedMessage.author}</span>
                        <span className={styles.chatQuotedSnippet}>{msg.quotedMessage.snippet}</span>
                      </div>
                    )
                  ) : null}
                  <div className={msg.from === 'user' ? `${styles.chatBubble} ${styles.chatBubbleUser}` : `${styles.chatBubble} ${styles.chatBubbleHub}`}>
                    {msg.text}
                  </div>
                  {msg.actionLabel && msg.actionSlug ? (
                    <Link href={`/apps/${msg.actionSlug}`} className={styles.chatActionBtn}>
                      {msg.actionLabel}
                    </Link>
                  ) : null}
                  <div className={msg.from === 'user' ? `${styles.chatMetaRow} ${styles.chatMetaRowUser}` : styles.chatMetaRow}>
                    <span className={msg.from === 'user' ? `${styles.chatTime} ${styles.chatTimeUser}` : styles.chatTime}>
                      {msg.time}
                    </span>
                    {canReply ? (
                      <button
                        type="button"
                        className={styles.chatReplyBtn}
                        onClick={() => beginReply(msg)}
                        aria-label={`Reply to ${senderName}`}
                      >
                        <Reply size={12} /> Reply
                      </button>
                    ) : null}
                    {canDelete && msg.communityPostId ? (
                      <button
                        type="button"
                        className={styles.chatDeleteBtn}
                        onClick={() => {
                          if (window.confirm('Delete this post? This cannot be undone. To change it, delete and post again.')) {
                            void deleteMessage(msg.communityPostId as string);
                          }
                        }}
                        aria-label="Delete your post"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    ) : null}
                  </div>
                  {msg.communityPostId ? (
                    <ChatReactionRow
                      postId={msg.communityPostId}
                      reactions={msg.reactions}
                      onToggle={(postId, emoji) => void toggleReaction(postId, emoji)}
                      // A member may only react to posts they did not author. On the member's own
                      // post the row is read-only: it shows others' reactions but offers no way to add.
                      readOnly={msg.from === 'user'}
                    />
                  ) : null}
                </div>
              </div>
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Concierge "ask what you need" chips — persistent (shown whether or not the chat already has
          messages), so a member can always tap one. Unlike the old hidden chips (#471) that merely
          filled the composer with no answer, tapping here runs the local concierge (sendConciergeAsk):
          it posts the question and an instant reply pointing at the best-matching feature, so there is
          always an immediate response. The "@ Mentions" filter chip leads this row at every width
          (owner directive, 2026-07-17; it previously floated alone above the desktop stream) —
          same pill size as the question chips, sky-blue so it stays visually distinct; it scrolls
          with the row. The rail always renders because the chip is always present. */}
      <div className={styles.conciergeChipRail} role="group" aria-label="Ask what you need">
        {/* Mentions filter — icon-only "@" chip (the word was dropped to match the 📣 chip), so the
            two stream filters read as a matched pair of small glyph pills. */}
        <button
          type="button"
          className={mentionsOnly && !notificationsOpen ? `${styles.mentionsFilterBtn} ${styles.mentionsFilterBtnActive}` : styles.mentionsFilterBtn}
          onClick={() => { setNotificationsOpen(false); toggleMentionsOnly(); }}
          aria-pressed={mentionsOnly && !notificationsOpen}
          aria-label={mentionsOnly ? 'Show all messages' : 'Show only messages that mention you'}
          title={mentionsOnly ? 'Show all messages' : 'Show only messages that mention you'}
        >
          <AtSign size={15} aria-hidden="true" />
        </button>
        {/* Announcements filter — "Announcements" is too long for a chip, so it shows the 📣 emoji
            alone. Filtering to announcements lets a member with limited message history still surface
            official updates that scrolled off the recent page. */}
        <button
          type="button"
          className={announcementsOnly && !notificationsOpen ? `${styles.announcementsFilterBtn} ${styles.announcementsFilterBtnActive}` : styles.announcementsFilterBtn}
          onClick={() => { setNotificationsOpen(false); toggleAnnouncementsOnly(); }}
          aria-pressed={announcementsOnly && !notificationsOpen}
          aria-label={announcementsOnly ? 'Show all messages' : 'Show only announcements'}
          title={announcementsOnly ? 'Show all messages' : 'Show only announcements'}
        >
          <span aria-hidden="true">📣</span>
        </button>
        {/* Notifications center — the 🔔 chip opens the member's cross-plugin notifications feed in
            place of the chat stream (a separate view, not a filter). Styled like the filter chips so
            the three read as a row of glyph pills. */}
        <button
          type="button"
          className={notificationsOpen ? `${styles.notificationsFilterBtn} ${styles.notificationsFilterBtnActive}` : styles.notificationsFilterBtn}
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-pressed={notificationsOpen}
          aria-label={notificationsOpen ? 'Back to the conversation' : 'Show your notifications'}
          title={notificationsOpen ? 'Back to the conversation' : 'Show your notifications'}
        >
          <span aria-hidden="true">🔔</span>
        </button>
        {notificationsOpen ? null : starterPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className={styles.conciergeChip}
            title={prompt}
            onClick={() => sendConciergeAsk(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Composer + helpers hide while the notifications center is open — you read notifications
          there, you don't post into them. The chip row above stays so 🔔 can toggle back. */}
      {notificationsOpen ? null : (
      <>
      {/* @comic mention affordance + helper copy (per the locked design / naming rules). On phones
          the standalone "@comic" chip duplicated the "@comic" in the helper text, so the chip is
          dropped and the line is relabeled to name the assistant and its human-in-the-loop review. */}
      <div className={styles.comicComposerHelper}>
        <span className={styles.comicComposerHelperText}>
          AI Assistant (human in the loop) — type <span className={styles.comicComposerHelperToken}>@comic</span> to ask
        </span>
      </div>

      {/* "Replying to …" banner: shows a one-line quote preview and a cancel (X). Sending while
          this is set posts the message as a Signal-style reply to that peer post. */}
      {replyTarget ? (
        <div className={styles.composerReplyBanner}>
          <div className={styles.composerReplyPreview}>
            <span className={styles.composerReplyLabel}>Replying to {replyTarget.quote.author}</span>
            <span className={styles.composerReplySnippet}>{replyTarget.quote.snippet}</span>
          </div>
          <button
            type="button"
            className={styles.composerReplyCancel}
            onClick={cancelReply}
            aria-label="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Subtle "X is typing…" line, only when the live connection surfaces someone typing. Kept on
          one quiet line above the composer so it sits with the existing dark design. */}
      {typingLabel ? (
        <div className={styles.typingIndicator} role="status" aria-live="polite">
          <span className={styles.typingDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {typingLabel}
        </div>
      ) : null}

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
          className={input.trim() ? `${styles.chatSendBtn} ${styles.chatSendBtnActive}` : styles.chatSendBtn}
          onClick={() => {
            void sendMessage();
          }}
          aria-label={composerMentionsComic ? 'Ask the AI Assistant' : 'Send message'}
          disabled={isSending}
        >
          ➤
        </button>
      </div>

      <p className={styles.chatFootnote}>
        {isLive ? 'Human-in-the-loop AI support and community support channel.' : 'Support channel keeps syncing as new messages arrive.'}{' '}
        <a href="/guidelines" style={{ color: 'inherit', textDecoration: 'underline' }}>Community guidelines</a>
      </p>
      </>
      )}

      <ComicConsentModal open={consentModalOpen} onConfirm={() => void confirmConsent()} onDismiss={dismissConsent} />
    </div>
  );
}
