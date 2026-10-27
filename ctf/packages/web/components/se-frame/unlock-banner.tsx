'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SE_UNLOCK_WORDS as W, type SeUnlockStanding } from '@ctf/shared';
import styles from './se-frame.module.css';

// The Unlock banner on every 3.1 screen, for a member not approved yet: the day count, the way to
// finish, and, after day 14, that posting is paused. It can be closed only in the first week, and
// only until the next visit. An approved member never sees it.
export function UnlockBanner() {
  const [standing, setStanding] = useState<SeUnlockStanding | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/unlock/standing', { cache: 'no-store' })
      .then(async (res) => ((await res.json().catch(() => null)) as { standing?: SeUnlockStanding } | null)?.standing ?? null)
      .then((value) => {
        if (active) setStanding(value);
      })
      .catch(() => {
        // no-trace: without the standing the banner stays away; every gated route still says why.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!standing || standing.approved || closed) return null;
  return (
    <section aria-label="Unlock" className={standing.paused ? `${styles.unlock} ${styles.unlockPaused}` : styles.unlock}>
      <p className={styles.unlockTitle}>{standing.title}</p>
      <p className={styles.unlockText}>{standing.text}</p>
      <div className={styles.unlockRow}>
        <Link href={W.href} className={styles.unlockButton}>
          {W.open}
        </Link>
        {standing.closable ? (
          <button type="button" className={styles.unlockClose} onClick={() => setClosed(true)}>
            {W.close}
          </button>
        ) : null}
      </div>
    </section>
  );
}
