'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_ME_WORDS as W, type SeMarkedCard, type SeTodayCard } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { CardSheet } from '../today/card-sheet';
import { BackHeader } from './back-header';
import { CardRow } from './card-row';
import styles from './me.module.css';

// Me → Read and Hidden: the cards the member marked done, or Not for me, that are still around
// (GET /api/today/marks?mark=…). Tapping one opens it in place, as on Today and Me → Open.

type ListState = { kind: 'loading' } | { kind: 'ready'; cards: SeMarkedCard[] } | { kind: 'error'; message: string };

function useMarked(mark: 'done' | 'not_for_me') {
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/today/marks?mark=${mark}`, { cache: 'no-store' });
      if (!res.ok) return setState({ kind: 'error', message: await responseFailureText(res, W.listFailed, 'member') });
      setState({ kind: 'ready', cards: ((await res.json()) as { cards: SeMarkedCard[] }).cards });
    } catch (error) {
      setState({ kind: 'error', message: failureText(error, { area: 'se-frame', op: `me_marked_${mark}`, fallback: W.listFailed, audience: 'member' }) });
    }
  }, [mark]);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

function MarkedFace({ card }: { card: SeMarkedCard }) {
  return (
    <>
      <span className={styles.q} style={{ color: `var(--se-kind-${card.kind})` }}>
        {card.label}
      </span>
      <span className={styles.itemTitle}>{card.title}</span>
    </>
  );
}

export function MarkedList({ mark, viewerId, onBack }: { mark: 'done' | 'not_for_me'; viewerId: string; onBack: () => void }) {
  const { state, reload } = useMarked(mark);
  const [sheet, setSheet] = useState<SeTodayCard | null>(null);
  return (
    <div className={styles.stack}>
      <BackHeader title={mark === 'done' ? W.read : W.hidden} back={W.backToMe} onBack={onBack} />
      <p className={styles.text}>{mark === 'done' ? W.readIntro : W.hiddenIntro}</p>
      {state.kind === 'loading' ? <p className={styles.status}>…</p> : null}
      {state.kind === 'error' ? (
        <p role="alert" className={styles.status}>
          {state.message}
        </p>
      ) : null}
      {state.kind === 'ready' && state.cards.length === 0 ? <p className={styles.status}>{W.listEmpty}</p> : null}
      {state.kind === 'ready' && state.cards.length > 0 ? (
        <ul className={styles.list}>
          {state.cards.map((card) => (
            <li key={card.id}>
              <CardRow card={card} onSheet={setSheet}>
                <MarkedFace card={card} />
              </CardRow>
            </li>
          ))}
        </ul>
      ) : null}
      {sheet ? <CardSheet card={sheet} viewerId={viewerId} firstAnswer={null} onClose={() => setSheet(null)} onChanged={() => void reload()} /> : null}
    </div>
  );
}
