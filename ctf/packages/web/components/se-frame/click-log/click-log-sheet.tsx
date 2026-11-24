'use client';

import Link from 'next/link';
import { SE_CLICK_LOG_WORDS as W, CLICK_LOG_HISTORY_HREF } from '@ctf/shared';
import { SheetTop } from '../sheet/sheet-top';
import { useSheetFocus } from '../use-sheet-focus';
import { ClickLogForm } from './click-log-form';
import { useClickLogEntry, type ClickLogEntry } from './use-click-log-entry';
import styles from './click-log-sheet.module.css';

// + New → "Log what happened": a quick pin that asks for the member's location as it opens, with the
// 3.0 ClickLog entry form under it, logging through the same route. Once saved it says so and links
// to the 3.0 page for history and trends, one of the 3.1 places that link to 3.0. Focus moves into
// the sheet when it opens and back to the line that opened it when it closes; Escape closes it.

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

export function ClickLogSheet({ onClose }: { onClose: () => void }) {
  const entry = useClickLogEntry();
  const sheet = useSheetFocus(onClose);
  return (
    <div className={styles.backdrop}>
      <section ref={sheet} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="se-click-log-title" className={styles.sheet}>
        <SheetTop className={styles.top} closeClassName={styles.close} closeLabel={W.close} onClose={onClose}>
          <span className={styles.eyebrow}>{W.eyebrow}</span>
        </SheetTop>
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
