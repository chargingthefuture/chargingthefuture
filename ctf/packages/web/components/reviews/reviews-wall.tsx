import type { Review } from './reviews-shared';
import { reviewAccent, reviewInitial, reviewSourceLabel } from './reviews-shared';
import styles from './reviews-wall.module.css';

// The "What Survivors Are Saying" wall — a simple, readable card wall of the same
// owner-curated reviews the widget cycles through. Server-rendered from the
// curated list (no client fetch, no flash). Purely presentational.

export function ReviewsWall({ reviews }: { reviews: Review[] }) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>What survivors are saying</h1>
        <p className={styles.sub}>Real comments from the community, linked to where they were posted.</p>
      </div>

      {reviews.length === 0 ? (
        <p className={styles.empty}>No reviews to show yet.</p>
      ) : (
        <div className={styles.grid}>
          {reviews.map((review) => (
            <article key={review.id} className={styles.card}>
              <div className={styles.head}>
                <span
                  className={styles.avatar}
                  style={{ background: reviewAccent(review.id) }}
                  aria-hidden="true"
                >
                  {reviewInitial(review.author)}
                </span>
                <span>
                  <span className={styles.author}>{review.author}</span>
                  {review.context ? <span className={styles.context}>{review.context}</span> : null}
                </span>
              </div>
              <p className={styles.quote}>&ldquo;{review.quote}&rdquo;</p>
              <a
                className={styles.sourceLink}
                href={review.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {reviewSourceLabel(review.source)} ↗
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
