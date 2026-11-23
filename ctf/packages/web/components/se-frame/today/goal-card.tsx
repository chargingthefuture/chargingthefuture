'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { SE_GOAL_SHARE_WORDS, seGoalPercent, type SeTodayCard, type SeTodayGoal } from '@ctf/shared';
import { GoalShareSheet } from '../share/goal-share-sheet';
import { CardSheet } from './card-sheet';
import { forgetOpenCard, readOpenCard, rememberOpenCard } from './reload-place';
import styles from './today.module.css';

// The viewer's own PeerProgramming goal on Today (the approved 3.1 board "Today, a quiet day"): the
// label says how many of its tasks are taken, a bar shows it, and Share this goal opens the share
// picture. An open goal opens in place like any ask, with the poster's Done and keep-up controls; a
// reached goal opens the board.

type Props = { card: SeTodayCard & { goal: SeTodayGoal }; viewerId: string; dot: ReactNode; onChanged?: () => void };

export function GoalCard({ card, viewerId, dot, onChanged }: Props) {
  const [sheet, setSheetState] = useState(false);
  // The open sheet is remembered, so a reload of the page opens it again (reload-place.ts).
  useEffect(() => {
    if (readOpenCard()?.id === card.id) setSheetState(true);
  }, [card.id]);
  const setSheet = (next: boolean) => {
    if (next) rememberOpenCard({ id: card.id, sheet: true });
    else forgetOpenCard(card.id);
    setSheetState(next);
  };
  const [share, setShare] = useState(false);
  const percent = seGoalPercent(card.goal);
  const text = (
    <>
      <span className={styles.label} style={{ color: 'var(--se-kind-ask)' }}>
        {card.label}
      </span>
      <span className={styles.cardTitle}>{card.title}</span>
    </>
  );
  const sharer = card.author ? { handle: card.author.handle, accountId: card.author.accountId } : null;
  return (
    <article className={styles.card}>
      {dot}
      <button type="button" className={styles.textButton} aria-haspopup="dialog" onClick={() => setSheet(true)}>
        {text}
      </button>
      <div className={styles.goalBar} role="progressbar" aria-label={card.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className={styles.goalBarFill} style={{ width: `${percent}%` }} />
      </div>
      <button type="button" className={styles.goalShare} aria-haspopup="dialog" onClick={() => setShare(true)}>
        {SE_GOAL_SHARE_WORDS.shareThisGoal}
      </button>
      {sheet ? <CardSheet card={card} viewerId={viewerId} firstAnswer={null} onClose={() => setSheet(false)} onChanged={onChanged} /> : null}
      {share ? <GoalShareSheet share={{ ...card.goal, title: card.title }} sharer={sharer} onClose={() => setShare(false)} /> : null}
    </article>
  );
}
