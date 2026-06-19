'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AtSign } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { PublicCommunityPost } from '../../lib/feed/types';
import type { ChatMessage, ComicStreamItem, ShellCurrentUser, ShellStats } from './shell-types';
import { useHomeChat } from './use-home-chat';
import { ComicAnswerCard, ComicPendingCard } from './comic-cards';
import { ComicConsentModal } from './comic-consent-modal';
import styles from './community-shell.module.css';

const ECONOMY_TARGET_USD = 300_000_000_000;

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

  // Auto-scroll the chat to the latest entry when the stream grows (a sent message, a concierge
  // reply, or new polled history), so members always land on what they saw last — like a normal chat.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [streamEntries.length]);

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

        {streamEntries.map((entry) => {
          if (entry.kind === 'comic') {
            const { item } = entry;
            if (item.status === 'answered') {
              return (
                <ComicAnswerCard
                  key={`comic-${item.questionTurnId}`}
                  item={item}
                  askedByLabel={currentUser.displayName}
                  onRate={rateComicAnswer}
                />
              );
            }
            return (
              <ComicPendingCard
                key={`comic-${item.questionTurnId}`}
                item={item}
                askedByLabel={currentUser.displayName}
              />
            );
          }

          const msg = entry.message;
          return (
            <div
              key={msg.id}
              className={msg.from === 'user' ? `${styles.chatRow} ${styles.chatRowUser}` : styles.chatRow}
            >
              {msg.from === 'hub' ? <div className={styles.chatAvatar} aria-hidden="true">SH</div> : null}
              <div className={styles.chatBubbleGroup}>
                <div className={msg.from === 'user' ? `${styles.chatBubble} ${styles.chatBubbleUser}` : `${styles.chatBubble} ${styles.chatBubbleHub}`}>
                  {msg.text}
                </div>
                {msg.actionLabel && msg.actionSlug ? (
                  <Link href={`/apps/${msg.actionSlug}`} className={styles.chatActionBtn}>
                    {msg.actionLabel}
                  </Link>
                ) : null}
                <span className={msg.from === 'user' ? `${styles.chatTime} ${styles.chatTimeUser}` : styles.chatTime}>
                  {msg.time}
                </span>
              </div>
            </div>
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
