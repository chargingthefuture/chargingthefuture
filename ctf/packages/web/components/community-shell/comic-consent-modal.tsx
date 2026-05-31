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

export function ComicConsentModal({ open, onConfirm, onDismiss }: ComicConsentModalProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onDismiss]);

  if (!open) {
    return null;
  }

  return (
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
      <div className={styles.comicConsentModal}>
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
                <Icon size={18} color="#A78BFA" />
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
