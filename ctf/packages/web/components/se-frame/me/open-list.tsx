'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_ME_WORDS, SE_OPEN_WORDS as W, seOpenCards, seTodayDayQuery, seTodayView, type SeOpenItem, type SeToday, type SeTodayCard } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { CardSheet } from '../today/card-sheet';
import { BackHeader } from './back-header';
import { CardRow } from './card-row';
import styles from './me.module.css';

// Me → Open: the cards on the member's Today they are part of and that are not done (seOpenCards),
// read from the same GET /api/today the Today tab draws. Tapping one opens it in place, as on
// Today; a card that never opens a sheet links to where it lives, and a 3.0 page is never opened.

type OpenState = { kind: 'loading' } | { kind: 'ready'; items: SeOpenItem[]; missing: string | null } | { kind: 'error'; message: string };

function useOpenCards(viewerId: string) {
  const [state, setState] = useState<OpenState>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/today?${seTodayDayQuery()}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return setState({ kind: 'error', message: await responseFailureText(res, W.failed, 'member') });
      const today = ((await res.json()) as { today: SeToday }).today;
      setState({ kind: 'ready', items: seOpenCards(today.cards, viewerId), missing: seTodayView(today, { read: [], hidden: [] }, 'all').missingLine });
    } catch (error) {
      setState({ kind: 'error', message: failureText(error, { area: 'se-frame', op: 'me_open', fallback: W.failed, audience: 'member' }) });
    }
  }, [viewerId]);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

function ItemFace({ item }: { item: SeOpenItem }) {
  return (
    <>
      <span className={styles.q} style={{ color: `var(--se-kind-${item.card.kind})` }}>
        {item.card.label}
      </span>
      <span className={styles.itemTitle}>{item.card.title}</span>
      <span className={styles.q}>{item.line}</span>
    </>
  );
}

export function OpenList({ viewerId, onBack }: { viewerId: string; onBack: () => void }) {
  const { state, reload } = useOpenCards(viewerId);
  const [sheet, setSheet] = useState<SeTodayCard | null>(null);
  return (
    <div className={styles.stack}>
      <BackHeader title={W.title} back={SE_ME_WORDS.backToMe} onBack={onBack} />
      <p className={styles.text}>{W.intro}</p>
      {state.kind === 'loading' ? <p className={styles.status}>{W.loading}</p> : null}
      {state.kind === 'error' ? (
        <p role="alert" className={styles.status}>
          {state.message}
        </p>
      ) : null}
      {state.kind === 'ready' && state.missing ? (
        <p role="status" className={styles.status}>
          {state.missing}
        </p>
      ) : null}
      {state.kind === 'ready' && state.items.length === 0 ? <p className={styles.status}>{W.empty}</p> : null}
      {state.kind === 'ready' && state.items.length > 0 ? (
        <ul className={styles.list}>
          {state.items.map((item) => (
            <li key={item.card.id}>
              <CardRow card={item.card} onSheet={setSheet}>
                <ItemFace item={item} />
              </CardRow>
            </li>
          ))}
        </ul>
      ) : null}
      {sheet ? <CardSheet card={sheet} viewerId={viewerId} firstAnswer={null} onClose={() => setSheet(null)} onChanged={() => void reload()} /> : null}
    </div>
  );
}
