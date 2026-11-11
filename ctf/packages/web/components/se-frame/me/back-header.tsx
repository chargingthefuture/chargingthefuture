'use client';

import styles from './settings.module.css';

// The top of a screen Me opens: a round back button and the screen's title (board "Theme").
export function BackHeader({ title, back, onBack }: { title: string; back: string; onBack: () => void }) {
  return (
    <div className={styles.top}>
      <button type="button" className={styles.back} aria-label={back} onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <h1 className={styles.title}>{title}</h1>
    </div>
  );
}
