'use client';

import Link from 'next/link';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { ShellCurrentUser, ShellStats } from './shell-types';
import { useHomeChat } from './use-home-chat';
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
    </div>
  );
}

function AuthenticatedChatPanel({ stats, plugins, currentUser }: AuthenticatedChatPanelProps) {
  const implementedCount = plugins.filter((plugin) => plugin.availabilityState === 'implemented_shell').length;
  const opportunityValue = Math.max(ECONOMY_TARGET_USD - (stats.gdpValueUsd ?? 0), 0);
  const { messages, input, setInput, sendMessage, isSending, isLoading, isLive, error } = useHomeChat(currentUser);
  const supportStatus = isLive ? 'live support connected' : isLoading ? 'connecting live support…' : 'community support syncing';

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
        {isLoading && messages.length === 0 ? (
          <p className={styles.chatFootnote}>Loading live messages…</p>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <div className={styles.chatBubbleGroup}>
            <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
              Survivor Hub is live. Ask for housing, work, safety, or community support to start.
            </div>
          </div>
        ) : null}

        {messages.map((msg) => (
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
        ))}
      </div>

      <div className={styles.chatSuggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" className={styles.chatChip} onClick={() => setInput(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <div className={styles.chatInputWrap}>
        <label className={styles.visuallyHidden} htmlFor="chat-input">Message Survivor Hub</label>
        <input
          id="chat-input"
          className={styles.chatInput}
          placeholder="Ask Survivor Hub anything, or search resources…"
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
          aria-label="Send message"
          disabled={isSending}
        >
          ➤
        </button>
      </div>

      <p className={styles.chatFootnote}>
        {isLive ? 'Live support connected through Chyme and GetStream.' : 'Live support keeps syncing as new messages arrive.'}
      </p>
    </div>
  );
}
