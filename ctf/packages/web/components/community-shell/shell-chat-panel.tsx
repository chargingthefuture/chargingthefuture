'use client';

import Link from 'next/link';
import { useMemo, useRef } from 'react';
import { AtSign } from 'lucide-react';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { ChatMessage, ComicStreamItem, ShellCurrentUser, ShellStats } from './shell-types';
import { useHomeChat } from './use-home-chat';
import { ComicAnswerCard, ComicPendingCard } from './comic-cards';
import { ComicConsentModal } from './comic-consent-modal';
import styles from './community-shell.module.css';

const ECONOMY_TARGET_USD = 300_000_000_000;

const SUGGESTIONS = [
  'Show housing options near me',
  'What is the GDP tracker showing this week?',
  'Find local work opportunities',
  'Open the provider directory',
  'Check my Service Credits',
];

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

  const implementedCount = plugins.filter((plugin) => plugin.availabilityState === 'implemented_shell').length;
  const opportunityValue = Math.max(ECONOMY_TARGET_USD - (stats.gdpValueUsd ?? 0), 0);

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
        <div className={styles.chatBubbleGroup}>
          <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
            To start connecting with Survivor Hub and accessing community support, please sign in.
          </div>
        </div>
      </div>

      <div className={styles.chatSuggestions}>
        <Link href={signInUrl} className={styles.chatSignInLink}>
          Sign In to Get Started
        </Link>
        <p className={styles.chatSuggestionsInfo}>
          Survivor Hub is free and helps you access housing, work, safety resources, and connect with others in the community.
        </p>
      </div>

      {/* Locked composer — read-only stream; sign in (or @comic) to participate. */}
      <div className={styles.comicLockedComposer}>
        <span className={styles.comicLockedLock} aria-hidden="true">🔒</span>
        <span className={styles.comicLockedText}>Sign in to post — or type @comic to ask the AI Assistant…</span>
        <Link href={signInUrl} className={styles.comicLockedJoinBtn}>Join Free →</Link>
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

  // Tapping a suggestion chip fills the composer, then brings it into view and focuses it with the
  // caret at the end — so the fill is visible even when the composer sits below the fold on mobile.
  const selectSuggestion = (suggestion: string) => {
    setInput(suggestion);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.setSelectionRange(suggestion.length, suggestion.length);
    });
  };

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

  return (
    <div className={styles.chatPanelWrap}>
      <div className={styles.heroBanner}>
        <div className={styles.heroBannerContent}>
          <p className={styles.heroBannerTag}>✦ From Survivor to Thriver</p>
          <h1 className={styles.heroBannerTitle}>Good morning, {currentUser.displayName} — your network is active.</h1>
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
      </div>

      <div className={styles.chatSuggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" className={styles.chatChip} onClick={() => selectSuggestion(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      {/* @comic mention affordance + helper copy (per the locked design / naming rules). */}
      <div className={styles.comicComposerHelper}>
        <span className={composerMentionsComic ? `${styles.comicMentionChip} ${styles.comicMentionChipActive}` : styles.comicMentionChip}>
          <AtSign size={12} /> comic
        </span>
        <span className={styles.comicComposerHelperText}>
          Type <span className={styles.comicComposerHelperToken}>@comic</span> to ask the AI Assistant
        </span>
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
