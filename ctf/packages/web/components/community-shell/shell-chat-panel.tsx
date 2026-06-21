'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AtSign, Reply, SmilePlus, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { PublicCommunityPost } from '../../lib/feed/types';
import { FEED_REACTION_EMOJIS } from '../../lib/feed/constants';
import type { ChatMessage, ComicStreamItem, ShellCurrentUser, ShellStats } from './shell-types';
import { useHomeChat } from './use-home-chat';
import { ComicAnswerCard, ComicPendingCard } from './comic-cards';
import { ComicConsentModal } from './comic-consent-modal';
import styles from './community-shell.module.css';

const ECONOMY_TARGET_USD = 300_000_000_000;

// Avatar glyph for a chat sender: "SH" for the Survivor Hub system/AI, otherwise the first letter of
// the member's handle. Keeps each post attributable instead of every row reading as the same "SH".
function avatarFromSender(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed.toLowerCase() === 'survivor hub') return 'SH';
  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return handle.charAt(0).toUpperCase() || 'SH';
}

function formatScaledValue(value: number | null, prefix = ''): string {
  if (!value) return `${prefix}0`;
  if (value >= 1_000_000_000) return `${prefix}${(value / 1_000_000_000).toFixed(0)}B`;
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
  return `${prefix}${value.toLocaleString()}`;
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

// Signed-out Commons: community (peer) posts are public the way Quora posts are, so a not-signed-in
// visitor reads them here — read-only and nothing else (no AI assistant, no concierge chips, no
// composer). Posts come from the public, unauthenticated endpoint, which itself only returns posts
// when an admin has turned public viewing on. When public viewing is off (or the read fails), we fall
// back to the plain sign-in prompt. A single sign-in call-to-action lets a visitor join to take part.
function PublicCommunityPanel({ stats, plugins, signInUrl }: { stats: ShellStats; plugins: PluginRegistryItem[]; signInUrl: string }) {
  const implementedCount = plugins.filter((plugin) => plugin.availabilityState === 'implemented_shell').length;
  const opportunityValue = Math.max(ECONOMY_TARGET_USD - (stats.gdpValueUsd ?? 0), 0);

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
        <div className={styles.heroStats}>
          <div className={styles.heroStatBlock}>
            <span className={styles.heroStatValue} style={{ color: '#A78BFA' }}>
              {formatScaledValue(stats.memberCount)}
            </span>
            <span className={styles.heroStatLabel}>Members</span>
          </div>
          <div className={styles.heroStatBlock}>
            <span className={styles.heroStatValue} style={{ color: '#38BDF8' }}>
              {formatScaledValue(stats.gdpValueUsd, '$')}
            </span>
            <span className={styles.heroStatLabel}>GDP</span>
          </div>
          <div className={styles.heroStatBlock}>
            <span className={styles.heroStatValue} style={{ color: '#34D399' }}>
              {formatScaledValue(opportunityValue, '$')}
            </span>
            <span className={styles.heroStatLabel}>Opportunity</span>
          </div>
        </div>
      </div>

      <div className={styles.chatMessages}>
        {loading ? (
          <p className={styles.chatFootnote}>Loading community posts…</p>
        ) : hasPosts ? (
          posts.map((post) => {
            const authorLabel = post.authorUsername ? `@${post.authorUsername}` : 'Community member';
            const initial = post.authorUsername ? post.authorUsername.charAt(0).toUpperCase() : 'C';
            return (
              <div key={post.id} className={styles.chatRow}>
                <div className={styles.chatAvatar} aria-hidden="true">{initial}</div>
                <div className={styles.chatBubbleGroup}>
                  <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>{post.body}</div>
                  <span className={styles.chatTime}>{authorLabel} · {formatPostTime(post.createdAtIso)}</span>
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

// Compact reaction row under a peer bubble: each emoji that has at least one reaction shows as a
// pill (emoji + count, highlighted when the member reacted), plus a small "add reaction"
// affordance that reveals the fixed quick set to pick from. Tapping a pill or a picker emoji
// toggles the reaction. Only rendered for peer posts (which carry a communityPostId).
function ChatReactionRow({
  postId,
  reactions,
  onToggle,
}: {
  postId: string;
  reactions: ChatMessage['reactions'];
  onToggle: (postId: string, emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const summaries = reactions ?? [];

  return (
    <div className={styles.chatReactionRow}>
      {summaries.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          className={reaction.reactedByMe ? `${styles.chatReactionPill} ${styles.chatReactionPillActive}` : styles.chatReactionPill}
          onClick={() => onToggle(postId, reaction.emoji)}
          aria-pressed={reaction.reactedByMe}
          aria-label={`${reaction.emoji} reaction, ${reaction.count}${reaction.reactedByMe ? ', you reacted' : ''}`}
        >
          <span aria-hidden="true">{reaction.emoji}</span>
          <span className={styles.chatReactionCount}>{reaction.count}</span>
        </button>
      ))}

      <button
        type="button"
        className={styles.chatReactionAdd}
        onClick={() => setPickerOpen((open) => !open)}
        aria-expanded={pickerOpen}
        aria-label="Add a reaction"
      >
        <SmilePlus size={14} />
      </button>

      {pickerOpen ? (
        <div className={styles.chatReactionPicker} role="menu" aria-label="Pick a reaction">
          {FEED_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={styles.chatReactionPickerBtn}
              onClick={() => {
                onToggle(postId, emoji);
                setPickerOpen(false);
              }}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AuthenticatedChatPanel({ stats, plugins, currentUser }: AuthenticatedChatPanelProps) {
  const implementedCount = plugins.filter((plugin) => plugin.availabilityState === 'implemented_shell').length;
  const opportunityValue = Math.max(ECONOMY_TARGET_USD - (stats.gdpValueUsd ?? 0), 0);
  const {
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
    toggleReaction,
    lastSeenAtIso,
    markSeen,
    isSending,
    isLoading,
    isLive,
    error,
  } = useHomeChat(currentUser);
  const supportStatus = isLive ? 'live support connected' : isLoading ? 'connecting live support…' : 'community support syncing';
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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

    const entries: StreamEntry[] = [
      ...messages.map((message, index): StreamEntry => ({
        kind: 'message',
        message,
        epoch: toEpoch(message.sentAtIso, index),
        order: index,
      })),
      ...comicItems.map((item, index): StreamEntry => ({
        kind: 'comic',
        item,
        epoch: toEpoch(item.askedAtIso, index),
        order: index,
      })),
    ];

    entries.sort((a, b) => (a.epoch - b.epoch) || (a.order - b.order));
    return entries;
  }, [messages, comicItems]);

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
      {/* The "From Survivor to Thriver" hero + stats are hidden on mobile, where they ate most of the
          first screen before any chat was visible. Desktop keeps it. */}
      {!isMobile ? (
      <div className={styles.heroBanner}>
        <div className={styles.heroBannerContent}>
          <p className={styles.heroBannerTag}>✦ From Survivor to Thriver</p>
          <h1 className={styles.heroBannerTitle}>Welcome back, {currentUser.displayName} — your network is active.</h1>
          <p className={styles.heroBannerSub}>{implementedCount} live plugins · one economy · {supportStatus}.</p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStatBlock}>
            <span className={styles.heroStatValue} style={{ color: '#A78BFA' }}>
              {formatScaledValue(stats.memberCount)}
            </span>
            <span className={styles.heroStatLabel}>Members</span>
          </div>
          <div className={styles.heroStatBlock}>
            <span className={styles.heroStatValue} style={{ color: '#38BDF8' }}>
              {formatScaledValue(stats.gdpValueUsd, '$')}
            </span>
            <span className={styles.heroStatLabel}>GDP</span>
          </div>
          <div className={styles.heroStatBlock}>
            <span className={styles.heroStatValue} style={{ color: '#34D399' }}>
              {formatScaledValue(opportunityValue, '$')}
            </span>
            <span className={styles.heroStatLabel}>Opportunity</span>
          </div>
        </div>
      </div>
      ) : null}

      {error ? (
        <section className={styles.usernameAlert} role="status">
          {error}
        </section>
      ) : null}

      <div className={styles.chatMessages}>
        {isLoading && !hasContent ? (
          <p className={styles.chatFootnote}>Loading live messages…</p>
        ) : null}

        {!isLoading && !hasContent ? (
          <div className={styles.chatBubbleGroup}>
            <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
              Survivor Hub is live. Share with the community, or type <strong>@comic</strong> to ask the AI Assistant.
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
          const senderName = msg.senderLabel ?? 'Survivor Hub';
          // A peer post (it carries a community post id) can be replied to Signal-style.
          const canReply = Boolean(msg.communityPostId);
          return (
            <Fragment key={msg.id}>
              {divider}
              <div
                className={msg.from === 'user' ? `${styles.chatRow} ${styles.chatRowUser}` : styles.chatRow}
              >
                {msg.from === 'hub' ? <div className={styles.chatAvatar} aria-hidden="true">{avatarFromSender(senderName)}</div> : null}
                <div className={styles.chatBubbleGroup}>
                  {msg.from === 'hub' ? <span className={styles.chatSender}>{senderName}</span> : null}
                  {msg.quotedMessage ? (
                    <div className={styles.chatQuotedBlock}>
                      <span className={styles.chatQuotedAuthor}>{msg.quotedMessage.author}</span>
                      <span className={styles.chatQuotedSnippet}>{msg.quotedMessage.snippet}</span>
                    </div>
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
                  </div>
                  {msg.communityPostId ? (
                    <ChatReactionRow
                      postId={msg.communityPostId}
                      reactions={msg.reactions}
                      onToggle={(postId, emoji) => void toggleReaction(postId, emoji)}
                    />
                  ) : null}
                </div>
              </div>
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Concierge "ask what you need" chips — persistent (shown whether or not the chat already has
          messages), so a member can always tap one. Unlike the old hidden chips (#471) that merely
          filled the composer with no answer, tapping here runs the local concierge (sendConciergeAsk):
          it posts the question and an instant reply pointing at the best-matching feature, so there is
          always an immediate response. */}
      {starterPrompts.length > 0 ? (
        <div className={styles.conciergeChipRail} role="group" aria-label="Ask what you need">
          {starterPrompts.map((prompt) => (
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
      ) : null}

      {/* @comic mention affordance + helper copy (per the locked design / naming rules). On phones
          the standalone "@comic" chip duplicated the "@comic" in the helper text, so the chip is
          dropped and the line is relabeled to name the assistant and its human-in-the-loop review. */}
      <div className={styles.comicComposerHelper}>
        {isMobile ? (
          <span className={styles.comicComposerHelperText}>
            AI Assistant (human in the loop) — type <span className={styles.comicComposerHelperToken}>@comic</span> to ask
          </span>
        ) : (
          <>
            <span className={composerMentionsComic ? `${styles.comicMentionChip} ${styles.comicMentionChipActive}` : styles.comicMentionChip}>
              <AtSign size={12} /> comic
            </span>
            <span className={styles.comicComposerHelperText}>
              Type <span className={styles.comicComposerHelperToken}>@comic</span> to ask the AI Assistant
            </span>
          </>
        )}
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

      <div className={styles.chatInputWrap}>
        <label className={styles.visuallyHidden} htmlFor="chat-input">Share with the community, or type @comic to ask the AI Assistant</label>
        <input
          ref={inputRef}
          id="chat-input"
          className={styles.chatInput}
          placeholder="Share with the community, or type @comic to ask…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              // While the first-use consent modal is open, Enter belongs to the modal ("turn it
              // on"), not the composer. Sending here would only re-open the already-open modal.
              if (consentModalOpen) return;
              void sendMessage();
            }
          }}
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
        {isLive ? 'Human-in-the-loop AI support and community support channel.' : 'Support channel keeps syncing as new messages arrive.'}
      </p>

      <ComicConsentModal open={consentModalOpen} onConfirm={() => void confirmConsent()} onDismiss={dismissConsent} />
    </div>
  );
}
