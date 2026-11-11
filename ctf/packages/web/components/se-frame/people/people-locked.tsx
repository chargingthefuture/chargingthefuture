'use client';

import Link from 'next/link';
import { SE_PEOPLE_LOCKED_FACES, SE_PEOPLE_WORDS as W } from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import styles from './people.module.css';

// People for a member not approved yet, built to the approved board "People, not yet verified": ten
// faded faces that are nobody, how many people are listed (only the number), why names wait for one
// check, Finish Unlock, and what is open to them now.
export function PeopleLocked({ count, onToday }: { count: number | null; onToday: () => void }) {
  return (
    <>
      <div className={styles.faces} aria-hidden="true">
        {SE_PEOPLE_LOCKED_FACES.map((seed) => (
          <span key={seed} className={styles.lockedFace}>
            <SeAvatar accountId={seed} size={52} />
          </span>
        ))}
      </div>
      <section className={styles.lockedCard} aria-label={W.finishUnlock}>
        {count !== null ? <span className={styles.lockedNumber}>{count}</span> : null}
        <span className={styles.lockedLabel}>{W.lockedCount}</span>
        <p className={styles.lockedText}>{W.lockedText}</p>
        <Link href="/plugin/unlock" className={styles.finish}>
          {W.finishUnlock}
        </Link>
      </section>
      <section className={styles.openNow} aria-label={W.openNow}>
        <span className={styles.openTitle}>{W.openNow}</span>
        <p className={styles.lockedText}>{W.openNowText}</p>
        <button type="button" className={styles.backLink} onClick={onToday}>
          {W.backToToday}
        </button>
      </section>
    </>
  );
}
