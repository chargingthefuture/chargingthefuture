'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { SE_PERSON_SHEET_WORDS as W } from '@ctf/shared';
import styles from './person-sheet.module.css';
import { SheetTop } from '../sheet/sheet-top';

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
        <SheetTop className={styles.head} closeClassName={styles.round} closeLabel={W.close} onClose={onClose} closeRef={closeRef}>
          <span className={styles.kicker}>{title}</span>
        </SheetTop>
        {children}
      </section>
    </div>
  );
}
