'use client';

import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import styles from './bug-report-modal.module.css';

type SuccessProps = {
  // A flagged report is held for a human to read before anything is published. We
  // tell the member calmly and truthfully without changing the reassuring tone.
  heldForReview: boolean;
  onDone: () => void;
  onReportAnother: () => void;
};

export function BugReportSuccess({ heldForReview, onDone, onReportAnother }: SuccessProps) {
  return (
    <>
      <div className={`${styles.resultIcon} ${styles.resultIconSuccess}`} aria-hidden="true">
        <CheckCircle size={28} />
      </div>
      <h2 className={styles.resultTitle}>Got it — we&apos;ll look into this.</h2>
      <p className={styles.resultBody}>
        {heldForReview
          ? 'A member of our team will read your report before we act on it. You won’t get a reply, but your report makes a difference.'
          : 'We’ll read your report and use it to fix problems in the app. You won’t get a reply, but your report makes a difference.'}
      </p>
      <button type="button" className={styles.btnBlock} onClick={onDone}>
        Done
      </button>
      <button type="button" className={styles.btnLink} onClick={onReportAnother}>
        Report another problem
      </button>
    </>
  );
}

type ErrorProps = {
  onRetry: () => void;
  onCancel: () => void;
};

export function BugReportError({ onRetry, onCancel }: ErrorProps) {
  return (
    <>
      <div className={`${styles.resultIcon} ${styles.resultIconError}`} aria-hidden="true">
        <AlertCircle size={28} />
      </div>
      <h2 className={styles.resultTitle}>Couldn&apos;t send your report.</h2>
      <p className={styles.resultBody}>
        Check your connection and try again. What you wrote is still there — nothing has been
        lost.
      </p>
      <button type="button" className={styles.btnBlock} onClick={onRetry}>
        Try again
      </button>
      <button type="button" className={styles.btnLink} onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}

type RateLimitProps = {
  onClose: () => void;
};

export function BugReportRateLimit({ onClose }: RateLimitProps) {
  return (
    <>
      <div className={`${styles.resultIcon} ${styles.resultIconWait}`} aria-hidden="true">
        <Clock size={28} />
      </div>
      <h2 className={styles.resultTitle}>We already have your recent reports.</h2>
      <p className={styles.resultBody}>
        There&apos;s no need to send another one right now — try again in a little while.
      </p>
      <button type="button" className={styles.btnNeutral} onClick={onClose}>
        OK
      </button>
    </>
  );
}
