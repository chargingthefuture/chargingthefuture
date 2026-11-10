'use client';

import Link from 'next/link';
import { SE_ACTIVITY_WORDS as W, SE_CARD_LIFETIME_WORDS as L, seActivityView, seAgo, seRenewCardId, type SeActivityItem } from '@ctf/shared';
import { usePosterActions } from '../today/use-poster-actions';
import { useActivity } from './use-activity';
import styles from './activity.module.css';

// Activity: what needs the member's answer, then what happened. Opening an item marks it read. The
// day-14 notice on the member's own ask or offer carries its one-tap renew beside it.

function Renew({ cardId, onDone }: { cardId: string; onDone: () => void }) {
  const actions = usePosterActions(cardId, onDone);
  const { status } = actions;
  if (status.kind === 'done') return <p role="status" className={styles.text}>{status.text}</p>;
  return (
    <>
      <button type="button" className={styles.allRead} disabled={status.kind === 'busy'} onClick={() => void actions.renew()}>
        {status.kind === 'busy' ? L.renewing : L.renew}
      </button>
      {status.kind === 'error' ? <p role="alert" className={styles.text}>{status.text}</p> : null}
    </>
  );
}

function Row({ item, onOpen }: { item: SeActivityItem; onOpen: (_id: string) => void }) {
  const body = (
    <>
      <span className={styles.summary}>{item.summary}</span>
      <span className={styles.meta}>
        {item.isRead ? null : <span className={styles.isNew}>{W.isNew}</span>}
        {seAgo(item.createdAtIso)}
      </span>
    </>
  );
  if (!item.linkPath) {
    return (
      <button type="button" className={styles.row} onClick={() => onOpen(item.id)}>
        {body}
      </button>
    );
  }
  return (
    <Link href={item.linkPath} className={styles.row} onClick={() => onOpen(item.id)}>
      {body}
    </Link>
  );
}

function Group({ title, items, onOpen }: { title: string; items: SeActivityItem[]; onOpen: (_id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.group} aria-label={title}>
      <h2 className={styles.groupTitle}>{title}</h2>
      {items.map((item) => {
        const renewId = seRenewCardId(item);
        return (
          <div key={item.id} className={styles.group}>
            <Row item={item} onOpen={onOpen} />
            {renewId ? <Renew cardId={renewId} onDone={() => onOpen(item.id)} /> : null}
          </div>
        );
      })}
    </section>
  );
}

export function ActivityScreen() {
  const { state, reload, markRead, markAllRead } = useActivity();
  if (state.kind === 'loading') return <p className={styles.text}>{W.loading}</p>;
  if (state.kind === 'error') {
    return (
      <p role="alert" className={styles.text}>
        {W.failed} {state.message}{' '}
        <button type="button" className={styles.linkButton} onClick={() => void reload()}>
          {W.tryAgain}
        </button>
      </p>
    );
  }
  if (state.items.length === 0) return <p className={styles.text}>{W.empty}</p>;
  const view = seActivityView(state.items);
  return (
    <>
      <Group title={W.answer} items={view.answer} onOpen={markRead} />
      <Group title={W.happened} items={view.happened} onOpen={markRead} />
      {state.items.some((item) => !item.isRead) ? (
        <button type="button" className={styles.allRead} onClick={markAllRead}>
          {W.allRead}
        </button>
      ) : null}
    </>
  );
}
