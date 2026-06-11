'use client';

import { AlertCircle, X } from 'lucide-react';
import {
  BUG_REPORT_MESSAGE_MAX_LENGTH,
  BUG_REPORT_CONTEXT_MAX_LENGTH,
} from '@/lib/bug-reports/constants';
import styles from './bug-report-modal.module.css';

type BugReportFormProps = {
  message: string;
  context: string;
  submitting: boolean;
  onMessageChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function BugReportForm({
  message,
  context,
  submitting,
  onMessageChange,
  onContextChange,
  onSubmit,
  onCancel,
}: BugReportFormProps) {
  const canSend = message.trim().length > 0 && !submitting;

  return (
    <>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Report a problem</h2>
          <p className={styles.subtitle}>We read every report.</p>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onCancel}
          disabled={submitting}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabelRow}>
          <label className={styles.fieldLabel} htmlFor="bug-report-message">
            What went wrong?
          </label>
          <span className={styles.badgeRequired}>required</span>
        </div>
        <textarea
          id="bug-report-message"
          className={styles.textarea}
          placeholder="Describe what happened…"
          rows={3}
          maxLength={BUG_REPORT_MESSAGE_MAX_LENGTH}
          value={message}
          disabled={submitting}
          onChange={(event) => onMessageChange(event.target.value)}
        />
      </div>

      <div className={styles.fieldContext}>
        <div className={styles.fieldLabelRow}>
          <label className={styles.fieldLabel} htmlFor="bug-report-context">
            What were you trying to do?
          </label>
          <span className={styles.badgeOptional}>optional</span>
        </div>
        <textarea
          id="bug-report-context"
          className={styles.textarea}
          placeholder="This helps us understand the context…"
          rows={2}
          maxLength={BUG_REPORT_CONTEXT_MAX_LENGTH}
          value={context}
          disabled={submitting}
          onChange={(event) => onContextChange(event.target.value)}
        />
      </div>

      <div className={styles.privacyNote}>
        <AlertCircle size={14} className={styles.privacyNoteIcon} aria-hidden="true" />
        <span className={styles.privacyNoteText}>
          Our team reads these to fix problems. Please don&apos;t include passwords or personal
          details.
        </span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onSubmit}
          disabled={!canSend}
        >
          {submitting ? (
            <>
              <span>Sending</span>
              <span className={styles.sendingDots} aria-hidden="true">
                <span className={styles.sendingDot} />
                <span className={styles.sendingDot} />
                <span className={styles.sendingDot} />
              </span>
            </>
          ) : (
            'Send report'
          )}
        </button>
      </div>
    </>
  );
}
