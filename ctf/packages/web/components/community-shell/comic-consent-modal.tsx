'use client';

import { useEffect, useRef } from 'react';
import { Check, EyeOff, Lock, Server, ShieldCheck, Sparkles, X } from 'lucide-react';
import styles from './community-shell.module.css';

type ComicConsentModalProps = {
  open: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

// First-use AI-processing consent (the llm_consent_granted gate). Translated from the locked
// design's AIConsent mockup into the app's CSS-module approach. Self-hosted, no third parties.
const POINTS = [
  { icon: Server, title: 'Runs on our own servers', desc: 'The AI Assistant is self-hosted inside Survivor Hub. Your questions never leave our infrastructure.' },
  { icon: EyeOff, title: 'No third parties', desc: "We don't send your messages to outside AI companies, advertisers, or data brokers — ever." },
  { icon: ShieldCheck, title: 'A teammate reviews answers', desc: 'Sensitive answers are checked by a trained human before they reach you.' },
  { icon: Lock, title: 'Your safety comes first', desc: 'The assistant will never reveal your location or identity, or ask you to.' },
];

// Tab-focusable elements inside the dialog, used to cycle focus (focus trap).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Focus trap for a single Tab / Shift+Tab press: keep focus cycling within the dialog root.
function cycleFocusTrap(root: HTMLElement, event: KeyboardEvent) {
  const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !root.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (active === last || !root.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

export function ComicConsentModal({ open, onConfirm, onDismiss }: ComicConsentModalProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Remember the opener so focus can be restored when the dialog closes.
    const opener = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
        return;
      }

      // Enter confirms the dialog. On mobile the soft keyboard keeps focus in the chat input, so a
      // press of Return would otherwise fall through to the composer and silently re-open this same
      // modal instead of turning the assistant on. Treat Enter as "turn it on" — EXCEPT when a button
      // inside the dialog already has focus. A keyboard member who tabs to "Not now" and presses
      // Return means "not now"; granting consent there is the opposite of what they asked for. Leave
      // those presses alone and the browser fires the focused button's own click, so "Not now" and
      // the close button dismiss, and the confirm button confirms.
      if (event.key === 'Enter') {
        const root = modalRef.current;
        const active = document.activeElement;
        const onDialogButton =
          root !== null && active instanceof HTMLElement && root.contains(active) && active.tagName === 'BUTTON';
        if (onDialogButton) {
          return;
        }
        event.preventDefault();
        onConfirm();
        return;
      }

      if (event.key !== 'Tab') return;

      // Focus trap: keep Tab / Shift+Tab cycling within the dialog.
      const root = modalRef.current;
      if (root) cycleFocusTrap(root, event);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // Restore focus to the opener on close/unmount.
      opener?.focus?.();
    };
  }, [open, onDismiss, onConfirm]);

  if (!open) {
    return null;
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; keyboard users close via Escape (handler above) or the visible close button.
    <div
      className={styles.comicConsentOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comic-consent-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className={styles.comicConsentModal} ref={modalRef}>
        <div className={styles.comicConsentHeader}>
          <button type="button" className={styles.comicConsentClose} onClick={onDismiss} aria-label="Close">
            <X size={15} />
          </button>
          <div className={styles.comicConsentHeaderRow}>
            <div className={styles.comicConsentHeaderIcon} aria-hidden="true">
              <Sparkles size={22} color="#fff" />
            </div>
            <div>
              <h2 id="comic-consent-title" className={styles.comicConsentTitle}>Meet the AI Assistant</h2>
              <p className={styles.comicConsentTrigger}>Summon it any time by typing <span className={styles.comicConsentTriggerToken}>@comic</span></p>
            </div>
          </div>
          <p className={styles.comicConsentLede}>
            Before you use it for the first time, here&apos;s exactly how it works and how we protect you.
          </p>
        </div>

        <ul className={styles.comicConsentPoints}>
          {POINTS.map(({ icon: Icon, title, desc }) => (
            <li key={title} className={styles.comicConsentPoint}>
              <span className={styles.comicConsentPointIcon} aria-hidden="true">
                <Icon size={18} color="currentColor" />
              </span>
              <span className={styles.comicConsentPointBody}>
                <span className={styles.comicConsentPointTitle}>{title}</span>
                <span className={styles.comicConsentPointDesc}>{desc}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.comicConsentActions}>
          <button ref={confirmRef} type="button" className={styles.comicConsentConfirm} onClick={onConfirm}>
            <Check size={16} /> I understand — turn it on
          </button>
          <button type="button" className={styles.comicConsentDismiss} onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
