'use client';

import { SE_TRUST_WORDS as W } from '@ctf/shared';
import { TrustLines } from './trust-lines';
import type { TrustRead } from './use-trust';
import styles from './trust.module.css';

// One trust read in every state: reading, locked by Unlock, failed with a way to try again, or the
// lines. Me → Trust and People's profile both show it.
export function TrustReadView({ read, own, onRetry }: { read: TrustRead; own: boolean; onRetry: () => void }) {
  if (read.kind === 'loading') {
    return (
      <p className={styles.soft} role="status">
        {W.loading}
      </p>
    );
  }
  if (read.kind === 'locked') return <p className={styles.soft}>{W.locked}</p>;
  if (read.kind === 'failed') {
    return (
      <p role="alert" className={styles.soft}>
        {read.message}{' '}
        <button type="button" className={styles.retry} onClick={onRetry}>
          {W.tryAgain}
        </button>
      </p>
    );
  }
  return <TrustLines view={read.view} own={own} />;
}
