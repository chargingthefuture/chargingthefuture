'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { SE_PERSON_SHEET_WORDS as W } from '@ctf/shared';
import styles from './person-sheet.module.css';

// The sheet People's profile and quote open in, in the look of a Today card opened in place: focus
// moves to Close when it opens and back to whatever opened it when it closes, and Escape closes it.
export function PersonSheetFrame({ title, label, onClose, children }: { title: string; label: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // A popup inside the sheet (the Share control) closes first on its own Escape.
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"] [role="dialog"]')) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);
  return (
    <div className={styles.backdrop}>
      <button type="button" className={styles.scrim} aria-label={W.close} tabIndex={-1} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={label} className={styles.sheet}>
        <span className={styles.grip} aria-hidden="true" />
        <div className={styles.head}>
          <span className={styles.kicker}>{title}</span>
          <button ref={closeRef} type="button" className={styles.round} aria-label={W.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
