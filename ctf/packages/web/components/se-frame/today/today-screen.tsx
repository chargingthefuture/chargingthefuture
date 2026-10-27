'use client';

import { useState } from 'react';
import { SE_TODAY_FILTERS, seTodayView, type SeToday, type SeTodayFilter } from '@ctf/shared';
import { BroadcastCard, RoomCard } from './room-card';
import { TodayCard } from './today-card';
import { useToday, type TodayMarks } from './use-today';
import styles from './today.module.css';

// Today in 3.1: the broadcast while it is live, the Main Room, then the day's cards newest first.
// What a filter shows and when the done count appears is shared with Android (seTodayView).

function LiveCards({ today }: { today: SeToday | null }) {
  return (
    <>
      {today?.broadcast?.live ? <BroadcastCard broadcast={today.broadcast} /> : null}
      {today?.rooms.map((room) => <RoomCard key={room.key} room={room} />)}
    </>
  );
}

function FilterChips({ filter, onChange }: { filter: SeTodayFilter; onChange: (next: SeTodayFilter) => void }) {
  return (
    <div className={styles.chips} role="group" aria-label="Show">
      {SE_TODAY_FILTERS.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={filter === item.key}
          className={filter === item.key ? `${styles.chip} ${styles.chipOn}` : styles.chip}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Notices({ error, missingLine, loading, onRetry }: { error: string | null; missingLine: string | null; loading: boolean; onRetry: () => void }) {
  return (
    <>
      {error ? (
        <div role="alert" className={styles.notice}>
          <span>{error}</span>
          <button type="button" className={styles.actionButton} onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}
      {missingLine ? <p className={styles.noticeQuiet}>{missingLine}</p> : null}
      {loading ? <p className={styles.noticeQuiet}>Loading Today…</p> : null}
    </>
  );
}

function Timeline({ view, marks, mark }: { view: ReturnType<typeof seTodayView>; marks: TodayMarks; mark: (kind: keyof TodayMarks, id: string) => void }) {
  return (
    <div className={styles.timeline}>
      <span className={styles.line} aria-hidden="true" />
      {view.cards.map((card) => (
        <TodayCard
          key={card.id}
          card={card}
          read={marks.read.includes(card.id)}
          onRead={() => mark('read', card.id)}
          onHide={() => mark('hidden', card.id)}
        />
      ))}
      <div className={styles.caughtUp}>
        <span className={styles.caughtUpTitle}>{view.caughtUpLine}</span>
        <span className={styles.noticeQuiet}>New cards arrive as people post.</span>
      </div>
    </div>
  );
}

export function TodayScreen({ accountId }: { accountId: string }) {
  const { today, loading, error, marks, mark, reload } = useToday(accountId);
  const [filter, setFilter] = useState<SeTodayFilter>('all');
  const view = seTodayView(today, marks, filter);

  return (
    <>
      <LiveCards today={today} />
      <div className={styles.listHead}>
        <h2 className={styles.listTitle}>Today&apos;s cards</h2>
        {view.doneLine ? <span className={styles.doneCount}>{view.doneLine}</span> : null}
      </div>
      <FilterChips filter={filter} onChange={setFilter} />
      <Notices error={error} missingLine={view.missingLine} loading={!today && loading} onRetry={() => void reload()} />
      {today ? <Timeline view={view} marks={marks} mark={mark} /> : null}
    </>
  );
}
