'use client';

import { useEffect, useRef, useState } from 'react';
import type { Review } from './reviews-shared';
import { reviewAccent, reviewInitial, reviewSourceLabel } from './reviews-shared';
import styles from './reviews-widget.module.css';

// A calm, auto-cycling "social proof" popup that shows one real community review at
// a time in the corner of the public pages — the reviews equivalent of a
// "someone just subscribed" toast. It is decorative and non-blocking: it fetches
// the curated list from /api/reviews, appears after a short delay, advances slowly,
// pauses on hover/focus, can be dismissed for the session, and respects
// prefers-reduced-motion (no auto-advance, no fade). Renders nothing when there is
// no review to show or the visitor dismissed it.

const REVIEWS_ENDPOINT = '/api/reviews';
const WALL_HREF = '/reviews';
const DISMISS_KEY = 'ctf-reviews-widget-dismissed';
const APPEAR_DELAY_MS = 3500;
const ADVANCE_MS = 8000;
const FADE_MS = 220;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function ReviewsWidget({ endpoint = REVIEWS_ENDPOINT }: { endpoint?: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const pausedRef = useRef(false);

  // Load the curated list unless the visitor dismissed the widget this session.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_KEY) === '1') {
      return;
    }
    let cancelled = false;
    // Held outside the promise chain so the single cleanup below can cancel it — a
    // cleanup returned from inside .then() would go to the chain, not to useEffect.
    let appearTimer: number | undefined;
    fetch(endpoint, { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : { reviews: [] }))
      .then((data: { reviews?: Review[] }) => {
        if (cancelled) return;
        const list = Array.isArray(data.reviews) ? data.reviews : [];
        if (list.length === 0) return;
        setReviews(list);
        appearTimer = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
      })
      .catch(() => {
        /* a decorative widget never surfaces an error */
      });
    return () => {
      cancelled = true;
      if (appearTimer !== undefined) {
        window.clearTimeout(appearTimer);
      }
    };
  }, [endpoint]);

  // Slow auto-advance with a short fade between cards; paused on hover/focus and
  // skipped entirely under reduced-motion (the visitor advances manually via dots).
  useEffect(() => {
    if (!visible || reviews.length < 2 || prefersReducedMotion()) {
      return;
    }
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      setFadingOut(true);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % reviews.length);
        setFadingOut(false);
      }, FADE_MS);
    }, ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [visible, reviews.length]);

  if (!visible || reviews.length === 0) {
    return null;
  }

  const review = reviews[index];
  const accent = reviewAccent(review.id);

  function dismiss() {
    setVisible(false);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode — dismissal simply does not persist */
    }
  }

  return (
    <aside
      className={styles.wrap}
      aria-label="What community members are saying"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onFocusCapture={() => {
        pausedRef.current = true;
      }}
      onBlurCapture={() => {
        pausedRef.current = false;
      }}
    >
      <div className={styles.card}>
        <button type="button" className={styles.close} onClick={dismiss} aria-label="Dismiss reviews">
          ×
        </button>
        <div className={`${styles.fade} ${fadingOut ? styles.fadeOut : ''}`} aria-live="polite">
          <div className={styles.head}>
            <span className={styles.avatar} style={{ background: accent }} aria-hidden="true">
              {reviewInitial(review.author)}
            </span>
            <span className={styles.who}>
              <span className={styles.author}>{review.author}</span>
              {review.context ? <span className={styles.context}>{review.context}</span> : null}
            </span>
          </div>
          <p className={styles.quote}>&ldquo;{review.quote}&rdquo;</p>
        </div>
        <div className={styles.foot}>
          <a className={styles.sourceLink} href={review.sourceUrl} target="_blank" rel="noopener noreferrer">
            {reviewSourceLabel(review.source)} ↗
          </a>
          {reviews.length > 1 ? (
            <span className={styles.dots} aria-hidden="true">
              {reviews.map((r, i) => (
                <span key={r.id} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
              ))}
            </span>
          ) : null}
          <a className={styles.seeAll} href={WALL_HREF}>
            See all →
          </a>
        </div>
      </div>
    </aside>
  );
}
