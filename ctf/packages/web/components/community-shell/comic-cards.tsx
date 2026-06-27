'use client';

import Link from 'next/link';
import { ArrowRight, Flag, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ComicAnswerRating, ComicStreamItem } from './shell-types';
import styles from './community-shell.module.css';

type ComicAnswerCardProps = {
  item: ComicStreamItem;
  askedByLabel: string;
  onRate: (turnId: string, rating: ComicAnswerRating) => void;
};

// Relative "X ago" for a quick sense of recency.
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'just now';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// Full, unambiguous timestamp for a global audience: month spelled out, date, year, time, and the
// viewer's timezone — e.g. "June 21, 2026, 7:44 AM EDT".
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const datePart = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
  return `${datePart}, ${timePart}`;
}

// "47 min ago · June 21, 2026, 7:44 AM EDT" — quick recency plus the exact, global-clear timestamp.
function formatRelativeAndExact(iso: string): string {
  return `${formatRelativeTime(iso)} · ${formatTimestamp(iso)}`;
}

// Answered AI Assistant card: cyan treatment, Sparkles avatar, "AI Assistant" label, 🤖 AI Q&A
// badge, Q/A layout, and a helpful/not-helpful/flag rating row. Matches the locked Desktop mockup.
export function ComicAnswerCard({ item, askedByLabel, onRate }: ComicAnswerCardProps) {
  const ratable = item.answerTurnId !== null && !item.optimistic;

  return (
    <article className={styles.comicCard} aria-label="AI Assistant answer">
      <div className={styles.comicCardHead}>
        <div className={styles.comicCardAvatar} aria-hidden="true">
          <Sparkles size={18} color="currentColor" />
        </div>
        <div>
          <div className={styles.comicCardTitleRow}>
            <span className={styles.comicCardName}>AI Assistant</span>
            <span className={styles.comicCardBadge}>🤖 AI Q&amp;A</span>
          </div>
          <div className={styles.comicCardMeta}>Asked by {askedByLabel} · {formatRelativeAndExact(item.askedAtIso)}</div>
        </div>
      </div>

      <div className={styles.comicCardQuestion}>
        <span className={styles.comicCardQa}>Q: </span>
        <span className={styles.comicCardQuestionText}>{item.question}</span>
      </div>

      <p className={styles.comicCardAnswer}>
        <span className={styles.comicCardQa}>A: </span>
        {item.answer}
      </p>

      {item.linkedPlugins.length > 0 ? (
        <div className={styles.comicPluginLinks} aria-label="Applicable plugins">
          <span className={styles.comicPluginLinksLabel}>Explore:</span>
          {item.linkedPlugins.map((plugin) => (
            <Link key={plugin.slug} href={`/apps/${plugin.slug}`} className={styles.comicPluginLink}>
              {plugin.name} <ArrowRight size={12} />
            </Link>
          ))}
        </div>
      ) : null}

      {ratable && item.answerTurnId ? (
        <div className={styles.comicRatingRow} role="group" aria-label="Rate this answer">
          <span className={styles.comicRatingPrompt}>Was this helpful?</span>
          <button
            type="button"
            className={item.currentUserRating === 'helpful' ? `${styles.comicRatingBtn} ${styles.comicRatingBtnUp}` : styles.comicRatingBtn}
            aria-pressed={item.currentUserRating === 'helpful'}
            onClick={() => onRate(item.answerTurnId as string, 'helpful')}
          >
            <ThumbsUp size={13} /> Helpful
          </button>
          <button
            type="button"
            className={item.currentUserRating === 'not_helpful' ? `${styles.comicRatingBtn} ${styles.comicRatingBtnDown}` : styles.comicRatingBtn}
            aria-pressed={item.currentUserRating === 'not_helpful'}
            onClick={() => onRate(item.answerTurnId as string, 'not_helpful')}
          >
            <ThumbsDown size={13} /> Not helpful
          </button>
          <button
            type="button"
            className={item.currentUserRating === 'flagged' ? `${styles.comicRatingFlag} ${styles.comicRatingFlagActive}` : styles.comicRatingFlag}
            aria-pressed={item.currentUserRating === 'flagged'}
            onClick={() => onRate(item.answerTurnId as string, 'flagged')}
          >
            <Flag size={12} /> Flag
          </button>
        </div>
      ) : null}
    </article>
  );
}

type ComicPendingCardProps = {
  item: ComicStreamItem;
  askedByLabel: string;
};

// Pending "Reviewing for safety" card. CRITICAL INVARIANT: the asker only ever sees this card for
// an in-flight @comic question — never an unreviewed AI draft. The server enforces this (the
// message route returns only a holding response); this card reflects that holding state.
export function ComicPendingCard({ item, askedByLabel }: ComicPendingCardProps) {
  return (
    <article className={styles.comicPendingCard} aria-label="AI Assistant is reviewing">
      <div className={styles.comicCardHead}>
        <div className={styles.comicPendingAvatar} aria-hidden="true">
          <Sparkles size={18} color="currentColor" />
        </div>
        <div>
          <div className={styles.comicCardTitleRow}>
            <span className={styles.comicCardName}>AI Assistant</span>
            <span className={styles.comicPendingBadge}>
              <ShieldCheck size={9} /> Reviewing for safety
            </span>
          </div>
          <div className={styles.comicCardMeta}>Asked by {askedByLabel} · {formatRelativeAndExact(item.askedAtIso)}</div>
        </div>
      </div>

      <div className={styles.comicCardQuestion}>
        <span className={styles.comicCardQa}>Q: </span>
        <span className={styles.comicCardQuestionText}>{item.question}</span>
      </div>

      <div className={styles.comicPendingStatus}>
        <span className={styles.comicPendingDots} aria-hidden="true">
          <span className={styles.comicPendingDot} />
          <span className={styles.comicPendingDot} />
          <span className={styles.comicPendingDot} />
        </span>
        <span className={styles.comicPendingText}>
          Preparing your answer — a teammate is writing a verified response. Answers typically arrive within 72 hours.
        </span>
      </div>
    </article>
  );
}
