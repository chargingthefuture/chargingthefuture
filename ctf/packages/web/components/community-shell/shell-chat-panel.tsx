'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AtSign } from 'lucide-react';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { ChatMessage, ComicStreamItem, ShellCurrentUser, ShellStats } from './shell-types';
import { useHomeChat } from './use-home-chat';
import { ComicAnswerCard, ComicPendingCard } from './comic-stream-cards';
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
// Hub messages keep their API (chronological) order; comic items are time-sorted and appended, so
// AI cards interleave with community posts as the design shows.
type StreamEntry =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'comic'; item: ComicStreamItem };

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

  // Build the interleaved, time-ordered stream. Hub messages keep insertion order; comic items are
  // sorted by their absolute askedAt timestamp and merged in. The asker's own questions show their
  // display name; this hub only renders the current user's @comic items (server-scoped).
  const streamEntries = useMemo<StreamEntry[]>(() => {
    const entries: StreamEntry[] = messages.map((message) => ({ kind: 'message', message }));

    comicItems
      .slice()
      .sort((a, b) => new Date(a.askedAtIso).getTime() - new Date(b.askedAtIso).getTime())
      .forEach((item) => {
        entries.push({ kind: 'comic', item });
      });

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
          <button key={suggestion} type="button" className={styles.chatChip} onClick={() => setInput(suggestion)}>
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
          id="chat-input"
          className={styles.chatInput}
          placeholder="Share with the community, or type @comic to ask…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
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
        {isLive ? 'Live support connected through Chyme and GetStream.' : 'Live support keeps syncing as new messages arrive.'}
      </p>

      <ComicConsentModal open={consentModalOpen} onConfirm={() => void confirmConsent()} onDismiss={dismissConsent} />
    </div>
  );
}
