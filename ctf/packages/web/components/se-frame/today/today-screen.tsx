'use client';

import { useState } from 'react';
import { SE_DAYS_WON_TITLE, SE_MUTE_WORDS, SE_TODAY_FILTERS, seDaysWonLines, seTodayView, type SeToday, type SeTodayCard, type SeTodayFilter } from '@ctf/shared';
import Link from 'next/link';
import { BroadcastCard, RoomCard } from './room-card';
import { TodayCard } from './today-card';
import { useToday, type TodayMarks } from './use-today';
import styles from './today.module.css';

// Today in 3.1: Days won, the broadcast while it is live, the rooms, then the day's cards newest first.
// What a filter shows and when the done count appears is shared with Android (seTodayView).

function DaysWonCard({ daysWon }: { daysWon: NonNullable<SeToday['daysWon']> }) {
  const lines = seDaysWonLines(daysWon);
  return (
    <section aria-label={SE_DAYS_WON_TITLE} className={styles.daysWon}>
      <span className={styles.daysWonLabel}>{SE_DAYS_WON_TITLE}</span>
      <span className={styles.daysWonBig}>{lines.big}</span>
      <span className={styles.daysWonSmall}>{lines.small}</span>
    </section>
  );
}

// A visitor who is not signed in listens on the public room page instead of inside the frame.
function GuestRoomLink() {
  return (
    <section className={styles.daysWon} aria-label="Main Room">
      <span className={styles.daysWonLabel}>Main Room</span>
      <span className={styles.daysWonSmall}>Anyone can listen, no account needed.</span>
      <Link href="/apps/chyme" className={styles.actionButton}>
        Listen in
      </Link>
    </section>
  );
}

function LiveCards({ today, guest }: { today: SeToday | null; guest: boolean }) {
  return (
    <>
      {today?.daysWon ? <DaysWonCard daysWon={today.daysWon} /> : null}
      {today?.broadcast?.live ? <BroadcastCard broadcast={today.broadcast} /> : null}
      {guest ? (today ? <GuestRoomLink /> : null) : today?.rooms.map((room) => <RoomCard key={room.key} room={room} />)}
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

type TimelineProps = {
  view: ReturnType<typeof seTodayView>;
  marks: TodayMarks;
  mark: (kind: keyof TodayMarks, id: string) => void;
  onMute?: (card: SeTodayCard) => void;
};

function Timeline({ view, marks, mark, onMute }: TimelineProps) {
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
          onMute={card.author && onMute ? () => onMute(card) : undefined}
        />
      ))}
      <div className={styles.caughtUp}>
        <span className={styles.caughtUpTitle}>{view.caughtUpLine}</span>
        <span className={styles.noticeQuiet}>New cards arrive as people post.</span>
      </div>
    </div>
  );
}

// `accountId` null: a visitor who is not signed in reads the public Today (no names, no mute).
export function TodayScreen({ accountId }: { accountId: string | null }) {
  const { today, loading, error, marks, mark, reload } = useToday(accountId);
  const [filter, setFilter] = useState<SeTodayFilter>('all');
  const view = seTodayView(today, marks, filter);
  const [muteNote, setMuteNote] = useState<string | null>(null);

  // Mute the card's author: their cards leave Today from the next read. Nobody is told.
  const mute = async (card: SeTodayCard) => {
    if (!card.author) return;
    const res = await fetch('/api/account/mutes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ kind: 'person', target: card.author.accountId, label: card.author.handle }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { message?: string } | null;
    if (!res?.ok) return setMuteNote(`${SE_MUTE_WORDS.failed} ${body?.message ?? ''}`.trim());
    setMuteNote(SE_MUTE_WORDS.muted(card.author.handle));
    mark('hidden', card.id);
    void reload();
  };

  return (
    <>
      <LiveCards today={today} guest={accountId === null} />
      <div className={styles.listHead}>
        <h2 className={styles.listTitle}>Today&apos;s cards</h2>
        {view.doneLine ? <span className={styles.doneCount}>{view.doneLine}</span> : null}
      </div>
      <FilterChips filter={filter} onChange={setFilter} />
      <Notices error={error} missingLine={view.missingLine} loading={!today && loading} onRetry={() => void reload()} />
      {muteNote ? (
        <p role="status" className={styles.noticeQuiet}>
          {muteNote}
        </p>
      ) : null}
      {today ? <Timeline view={view} marks={marks} mark={mark} onMute={accountId ? (card) => void mute(card) : undefined} /> : null}
    </>
  );
}
