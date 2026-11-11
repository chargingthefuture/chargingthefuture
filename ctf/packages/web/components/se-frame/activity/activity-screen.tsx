'use client';

import Link from 'next/link';
import { SE_ACTIVITY_ICON_KIND, SE_ACTIVITY_ICON_PATHS, SE_ACTIVITY_WORDS as W, seActivityIcon, seActivityView, seActivityWhen, type SeActivityItem } from '@ctf/shared';
import { NeedCard } from './need-card';
import { useActivity } from './use-activity';
import styles from './activity.module.css';

// Activity (approved board "Activity"): what needs the member, answered in place, then what
// happened today and earlier, each with its icon and full date and time. Opening an item marks it
// read and follows its link. The icon circle is the kind's color lightly over the card, the same
// mix as seActivityTint on Android.

function RowBody({ item }: { item: SeActivityItem }) {
  const icon = seActivityIcon(item.notificationType);
  return (
    <>
      <span className={styles.icon} style={{ background: `color-mix(in srgb, var(--se-kind-${SE_ACTIVITY_ICON_KIND[icon]}) 20%, var(--se-card))` }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={SE_ACTIVITY_ICON_PATHS[icon]} />
        </svg>
      </span>
      <span className={styles.rowText}>
        <span className={styles.summary}>{item.summary}</span>
        <span className={styles.meta}>{seActivityWhen(item.createdAtIso)}</span>
      </span>
    </>
  );
}

function Row({ item, onOpen }: { item: SeActivityItem; onOpen: (_id: string) => void }) {
  if (!item.linkPath) {
    return (
      <button type="button" className={styles.row} onClick={() => onOpen(item.id)}>
        <RowBody item={item} />
      </button>
    );
  }
  return (
    <Link href={item.linkPath} className={styles.row} onClick={() => onOpen(item.id)}>
      <RowBody item={item} />
    </Link>
  );
}

function Group({ title, items, onOpen }: { title: string; items: SeActivityItem[]; onOpen: (_id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.group} aria-label={title}>
      <h2 className={styles.groupTitle}>{title}</h2>
      {items.map((item) => (
        <Row key={item.id} item={item} onOpen={onOpen} />
      ))}
    </section>
  );
}

export function ActivityScreen() {
  const { state, reload, markRead } = useActivity();
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
      {view.needs.length > 0 ? (
        <section className={styles.needs} aria-label={W.needs}>
          {view.needs.map((need) => (
            <NeedCard key={need.item.id} need={need} onRead={markRead} />
          ))}
        </section>
      ) : null}
      <Group title={W.today} items={view.today} onOpen={markRead} />
      <Group title={W.earlier} items={view.earlier} onOpen={markRead} />
      <p className={styles.end}>{W.end}</p>
    </>
  );
}
