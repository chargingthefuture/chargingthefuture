'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { SE_CLICK_LOG_WORDS as W, CLICK_LOG_HISTORY_HREF } from '@ctf/shared';
import { CloseIcon } from '../what-works/ww-add-sheet';
import { ClickLogForm } from './click-log-form';
import { useClickLogEntry, type ClickLogEntry } from './use-click-log-entry';
import styles from './click-log-sheet.module.css';

// Me → Tools → "Log what happened": the 3.0 ClickLog entry form in a 3.1 sheet, logging through the
// same route. Once saved it says so and links to the 3.0 page for history and trends, one of the
// 3.1 places that link to 3.0. Focus moves into the sheet when it opens and back to the tile when it
// closes; Escape closes it.

function Saved({ entry, onClose }: { entry: ClickLogEntry; onClose: () => void }) {
  return (
    <>
      <h2 className={styles.title}>{W.savedTitle}</h2>
      <p role="status" className={styles.rule}>
        {W.saved}
      </p>
      <Link href={CLICK_LOG_HISTORY_HREF} className={styles.historyLink}>
        {W.history}
      </Link>
      <span className={styles.spacer} />
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={entry.reset}>
          {W.another}
        </button>
        <button type="button" className={styles.primary} onClick={onClose}>
          {W.done}
        </button>
      </div>
    </>
  );
}

function useSheetFocus(onClose: () => void) {
  const sheet = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheet.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, []);
  return sheet;
}

export function ClickLogSheet({ onClose }: { onClose: () => void }) {
  const entry = useClickLogEntry();
  const sheet = useSheetFocus(onClose);
  return (
    <div className={styles.backdrop}>
      <section ref={sheet} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="se-click-log-title" className={styles.sheet}>
        <div className={styles.top}>
          <button type="button" className={styles.close} aria-label={W.close} onClick={onClose}>
            <CloseIcon />
          </button>
          <span className={styles.eyebrow}>{W.eyebrow}</span>
        </div>
        <h1 id="se-click-log-title" className={entry.saved ? styles.hidden : styles.title}>
          {W.title}
        </h1>
        {entry.saved ? (
          <Saved entry={entry} onClose={onClose} />
        ) : entry.setup.loading ? (
          <p role="status" className={styles.note}>
            {W.loading}
          </p>
        ) : (
          <ClickLogForm entry={entry} onCancel={onClose} />
        )}
      </section>
    </div>
  );
}
