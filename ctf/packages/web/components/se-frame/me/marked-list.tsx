'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SE_ME_WORDS as W, type SeMarkedCard } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { BackHeader } from './back-header';
import styles from './me.module.css';

// Me → Read and Hidden: the cards the member marked done, or Not for me, that are still around
// (GET /api/today/marks?mark=…). Each opens where the card's item lives.

type ListState = { kind: 'loading' } | { kind: 'ready'; cards: SeMarkedCard[] } | { kind: 'error'; message: string };

function useMarked(mark: 'done' | 'not_for_me'): ListState {
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    fetch(`/api/today/marks?mark=${mark}`, { cache: 'no-store' })
      .then(async (res) => {
        const next: ListState = res.ok
          ? { kind: 'ready', cards: ((await res.json()) as { cards: SeMarkedCard[] }).cards }
          : { kind: 'error', message: await responseFailureText(res, W.listFailed, 'member') };
        if (active) setState(next);
      })
      .catch((error: unknown) => {
        const message = failureText(error, { area: 'se-frame', op: `me_marked_${mark}`, fallback: W.listFailed, audience: 'member' });
        if (active) setState({ kind: 'error', message });
      });
    return () => {
      active = false;
    };
  }, [mark]);
  return state;
}

export function MarkedList({ mark, onBack }: { mark: 'done' | 'not_for_me'; onBack: () => void }) {
  const state = useMarked(mark);
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
              <Link href={card.href} className={styles.listItem}>
                <span className={styles.q} style={{ color: `var(--se-kind-${card.kind})` }}>
                  {card.label}
                </span>
                <span className={styles.itemTitle}>{card.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
