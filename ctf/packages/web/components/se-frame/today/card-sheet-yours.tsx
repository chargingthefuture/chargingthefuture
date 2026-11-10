'use client';

import { SE_CARD_LIFETIME_WORDS as W, seOnTodayUntil, type SeTodayCard } from '@ctf/shared';
import { usePosterActions } from './use-poster-actions';
import styles from './card-sheet.module.css';

// In a card opened in place, on an ask or offer the viewer posted: when it leaves Today, and the
// poster's own controls. An ask closes as Done or Closed, not done; one with no deadline, and an
// offer, can be kept up 14 more days. Leaving Today closes nothing; the item stays where it lives.

export function SheetYours({ card, onChanged }: { card: SeTodayCard; onChanged?: () => void }) {
  const actions = usePosterActions(card.id, onChanged);
  const mine = card.mine;
  if (!mine) return null;
  const { status } = actions;
  const busy = status.kind === 'busy';
  return (
    <section className={styles.answers} aria-label={W.yours}>
      <span className={styles.answersTitle}>
        {W.yours} · {seOnTodayUntil(mine.leavesIso)}
      </span>
      <div className={styles.yoursRow}>
        {mine.canClose ? (
          <>
            <button type="button" className={styles.talkPrimary} disabled={busy} onClick={() => void actions.close('done')}>
              {W.done}
            </button>
            <button type="button" className={styles.talkButton} disabled={busy} onClick={() => void actions.close('not_done')}>
              {W.notDone}
            </button>
          </>
        ) : null}
        {mine.canRenew ? (
          <button type="button" className={styles.talkButton} disabled={busy} onClick={() => void actions.renew()}>
            {status.kind === 'busy' && status.what === 'renew' ? W.renewing : W.renew}
          </button>
        ) : null}
      </div>
      {status.kind === 'done' ? <p role="status" className={styles.hint}>{status.text}</p> : null}
      {status.kind === 'error' ? <p role="alert" className={styles.hint}>{status.text}</p> : null}
    </section>
  );
}
