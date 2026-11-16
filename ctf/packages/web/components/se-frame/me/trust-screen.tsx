'use client';

import { useState } from 'react';
import { SE_ME_WORDS, SE_TRUST_SELF_PATH, SE_TRUST_WORDS as W } from '@ctf/shared';
import { TrustReadView } from '../trust/trust-read-view';
import { useTrust } from '../trust/use-trust';
import { BackHeader } from './back-header';
import styles from './me.module.css';

// Me → Trust: everything the 3.0 Trust card showed the member, in the 3.1 look. Their own lines,
// recomputed from what they have done, then exactly what any other member gets. Nothing here is a
// setting and nothing is a score.
export function TrustScreen({ onBack }: { onBack: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const read = useTrust(SE_TRUST_SELF_PATH, attempt);
  return (
    <div className={styles.stack}>
      <BackHeader title={W.title} back={SE_ME_WORDS.backToMe} onBack={onBack} />
      <p className={styles.text}>{W.meRow}</p>
      <TrustReadView read={read} own onRetry={() => setAttempt((n) => n + 1)} />
    </div>
  );
}
