'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { BugReportForm } from './bug-report-form';
import { BugReportSuccess, BugReportError, BugReportRateLimit } from './bug-report-result';
import {
  submitBugReport,
  derivePluginSlugFromPath,
  type BugReportSubmitResult,
} from './bug-report-submit';
import styles from './bug-report-modal.module.css';

type BugReportModalProps = {
  open: boolean;
  onClose: () => void;
};

// The modal walks through one of five states. The form and submitting states share
// the same body (submitting just disables it), so they collapse into 'form' with a
// `submitting` flag.
type ViewState = 'form' | 'success' | 'error' | 'rate_limited';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function BugReportModal({ open, onClose }: BugReportModalProps) {
  const pathname = usePathname();
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [message, setMessage] = useState('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<ViewState>('form');
  const [heldForReview, setHeldForReview] = useState(false);
  // The overlay is portalled to <body>. A sticky header above this component uses
  // backdrop-filter, which makes that header a containing block for position: fixed —
  // without the portal the inset:0 overlay is trapped inside the short header bar and only
  // the bottom action row shows. Gate the portal on a client-mount flag so SSR renders nothing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset to a clean, empty form whenever the modal is opened fresh.
  useEffect(() => {
    if (open) {
      setMessage('');
      setContext('');
      setSubmitting(false);
      setView('form');
      setHeldForReview(false);
    }
  }, [open]);

  const closeIfIdle = useCallback(() => {
    // Never tear the modal down mid-request; the in-progress state owns the screen.
    if (submitting) {
      return;
    }
    onClose();
  }, [onClose, submitting]);

  // Escape to close (when idle) and a focus trap, mirroring the consent modal.
  useEffect(() => {
    if (!open) {
      return;
    }
    const opener = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeIfIdle();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const root = modalRef.current;
      if (!root) {
        return;
      }
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [open, closeIfIdle]);

  const runSubmit = useCallback(async () => {
    if (message.trim().length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    let result: BugReportSubmitResult;
    try {
      result = await submitBugReport({
        message: message.trim(),
        context,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        pluginSlug: pathname ? derivePluginSlugFromPath(pathname) : undefined,
      });
    } finally {
      setSubmitting(false);
    }

    if (result.kind === 'success') {
      setHeldForReview(result.status === 'held_for_review');
      setView('success');
    } else if (result.kind === 'rate_limited') {
      setView('rate_limited');
    } else {
      // Error: keep the typed text exactly as it is so nothing is lost.
      setView('error');
    }
  }, [message, context, submitting, pathname]);

  const resetToForm = useCallback(() => {
    setMessage('');
    setContext('');
    setHeldForReview(false);
    setView('form');
  }, []);

  if (!open || !mounted) {
    return null;
  }

  const isResultView = view !== 'form';

  return createPortal(
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; keyboard users close via Escape (handler above) or the visible close button.
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-report-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeIfIdle();
        }
      }}
    >
      <div
        ref={modalRef}
        className={isResultView ? `${styles.modal} ${styles.modalNarrow}` : styles.modal}
      >
        {/* A hidden labeling node so the dialog always has an accessible name,
            including in the icon-only result states. */}
        <span id="bug-report-title" hidden>
          Report a problem
        </span>

        {view === 'form' && (
          <BugReportForm
            message={message}
            context={context}
            submitting={submitting}
            onMessageChange={setMessage}
            onContextChange={setContext}
            onSubmit={() => void runSubmit()}
            onCancel={closeIfIdle}
          />
        )}

        {view === 'success' && (
          <BugReportSuccess
            heldForReview={heldForReview}
            onDone={onClose}
            onReportAnother={resetToForm}
          />
        )}

        {view === 'error' && (
          <BugReportError onRetry={() => void runSubmit()} onCancel={onClose} />
        )}

        {view === 'rate_limited' && <BugReportRateLimit onClose={onClose} />}
      </div>
    </div>,
    document.body,
  );
}
