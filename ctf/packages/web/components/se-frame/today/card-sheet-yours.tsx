'use client';

import { useState } from 'react';
import { SE_CARD_LIFETIME_WORDS as W, seOnTodayUntil, type SeCardAnswer, type SeTodayCard } from '@ctf/shared';
import { usePosterActions } from './use-poster-actions';
import styles from './card-sheet.module.css';

// In a card opened in place, on an ask or offer the viewer posted: when it leaves Today, and the
// poster's own controls. An ask closes as Done or Closed, not done; one with no deadline, and an
// offer, can be kept up 14 more days. Leaving Today closes nothing; the item stays where it lives.
// Done on an ask somebody offered to help with asks who did it, from those members, one choice;
// with nobody, Done closes it straight away.

// Who did it: one button per member who answered I can help, and Back.
function WhoDidIt({ helpers, busy, onPick, onBack }: { helpers: SeCardAnswer[]; busy: boolean; onPick: (_id: string) => void; onBack: () => void }) {
  return (
    <>
      <span className={styles.answersTitle}>{W.whoDidIt}</span>
      <div className={styles.yoursRow}>
        {helpers.map((helper) => (
          <button key={helper.accountId} type="button" className={styles.talkPrimary} disabled={busy} onClick={() => onPick(helper.accountId)}>
            {helper.handle}
          </button>
        ))}
        <button type="button" className={styles.talkButton} disabled={busy} onClick={onBack}>
          {W.back}
        </button>
      </div>
    </>
  );
}

export function SheetYours({ card, helpers, onChanged }: { card: SeTodayCard; helpers: SeCardAnswer[]; onChanged?: () => void }) {
  const actions = usePosterActions(card.id, onChanged);
  const [picking, setPicking] = useState(false);
  const mine = card.mine;
  if (!mine) return null;
  const { status } = actions;
  const busy = status.kind === 'busy';
  return (
    <section className={styles.answers} aria-label={W.yours}>
      <span className={styles.answersTitle}>
        {W.yours} · {seOnTodayUntil(mine.leavesIso)}
      </span>
      {picking ? <WhoDidIt helpers={helpers} busy={busy} onPick={(id) => void actions.close('done', id)} onBack={() => setPicking(false)} /> : null}
      <div className={styles.yoursRow} hidden={picking}>
        {mine.canClose ? (
          <>
            <button type="button" className={styles.talkPrimary} disabled={busy} onClick={() => (helpers.length > 0 ? setPicking(true) : void actions.close('done'))}>
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
