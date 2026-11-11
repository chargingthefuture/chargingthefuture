'use client';

import { useEffect, useState } from 'react';
import { SE_DAYS_WON_HOW, SE_DAYS_WON_TITLE, SE_DAYS_WON_WHY, SE_MUTE_WORDS, SE_TODAY_FILTERS, seDaysWonLines, seTodayView, type SeToday, type SeTodayCard, type SeTodayFilter } from '@ctf/shared';
import { MatchingToggle } from './matching-toggle';
import { BroadcastCard, RoomCard } from './room-card';
import { TodayCard } from './today-card';
import { sendTodayFeedback } from './send-feedback';
import { WeekStrip } from './week-strip';
import { useToday, type MarkKind, type TodayMarks } from './use-today';
import { EmojiRain } from './emoji-rain';
import styles from './today.module.css';

// Today in 3.1: Days won, the broadcast while it is live, the rooms, then the day's cards newest first.
// What a filter shows is shared with Android (seTodayView). There is no done count: the timeline dot
// marks one card, and nothing totals them, so nobody is pushed to get through the day.

// "How it's counted" opens the definition in place, under the line.
function DaysWonCard({ daysWon }: { daysWon: NonNullable<SeToday['daysWon']> }) {
  const lines = seDaysWonLines(daysWon);
  const [how, setHow] = useState(false);
  return (
    <section aria-label={SE_DAYS_WON_TITLE} className={styles.daysWon}>
      <span className={styles.daysWonLabel}>{SE_DAYS_WON_TITLE}</span>
      <span className={styles.daysWonBig}>{lines.big}</span>
      <span className={styles.daysWonSmall}>{lines.small}</span>
      <button type="button" className={styles.howButton} aria-expanded={how} onClick={() => setHow((value) => !value)}>
        {SE_DAYS_WON_HOW}
      </button>
      {how ? <span className={styles.daysWonSmall}>{lines.how}</span> : null}
      {how ? (
        <a href={SE_DAYS_WON_WHY.href} target="_blank" rel="noreferrer" className={styles.howButton}>
          {SE_DAYS_WON_WHY.label}
        </a>
      ) : null}
    </section>
  );
}

function LiveCards({ today }: { today: SeToday | null }) {
  return (
    <>
      {today?.daysWon ? <DaysWonCard daysWon={today.daysWon} /> : null}
      {today ? <WeekStrip talks={today.week ?? []} /> : null}
      {today?.broadcast?.live ? <BroadcastCard broadcast={today.broadcast} /> : null}
      {today?.rooms.map((room) => <RoomCard key={room.key} room={room} broadcasting={today.broadcast?.live === true} />)}
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
  viewerId: string;
  view: ReturnType<typeof seTodayView>;
  marks: TodayMarks;
  mark: (kind: MarkKind, id: string) => void;
  toggle: (kind: MarkKind, id: string) => void;
  onSave: (card: SeTodayCard) => void;
  onMute?: (card: SeTodayCard) => void;
  onChanged: () => void;
};

function Timeline({ viewerId, view, marks, mark, toggle, onSave, onMute, onChanged }: TimelineProps) {
  return (
    <div className={styles.timeline}>
      <span className={styles.line} aria-hidden="true" />
      {view.cards.map((card) => (
        <TodayCard
          key={card.id}
          card={card}
          viewerId={viewerId}
          read={marks.read.includes(card.id)}
          onToggleDone={() => {
            if (!marks.read.includes(card.id)) sendTodayFeedback(card, 'done');
            toggle('read', card.id);
          }}
          onHide={() => {
            sendTodayFeedback(card, 'not_for_me');
            mark('hidden', card.id);
          }}
          onMute={card.author && onMute ? () => onMute(card) : undefined}
          onSave={() => onSave(card)}
          onChanged={onChanged}
        />
      ))}
      <div className={styles.caughtUp}>
        <span className={styles.caughtUpTitle}>{view.caughtUpLine}</span>
        <span className={styles.noticeQuiet}>{view.caughtUpNote}</span>
      </div>
    </div>
  );
}

// A visitor who is not signed in gets GuestToday (guest-today.tsx) instead.
// `onPresence` hands the "N Avens here" count to the title row above the screen. `rain` carries the
// emoji rain switch and the Days won total the account last saw (use-se-prefs.ts).
type RainPrefs = { on: boolean; seen: number | null | undefined; onSeen: (_total: number) => void };

export function TodayScreen({ accountId, onPresence, rain }: { accountId: string; onPresence?: (count: number | null) => void; rain?: RainPrefs }) {
  const { today, loading, error, marks, mark, toggle, save, saveNote, reload } = useToday(accountId);
  const presence = today?.presence ?? null;
  useEffect(() => onPresence?.(presence), [onPresence, presence]);
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
      {rain ? <EmojiRain on={rain.on} daysWon={today?.daysWon} seen={rain.seen} onSeen={rain.onSeen} /> : null}
      <LiveCards today={today} />
      <div className={styles.listHead}>
        <h2 className={styles.listTitle}>Today&apos;s cards</h2>
      </div>
      <FilterChips filter={filter} onChange={setFilter} />
      {filter === 'matches' ? <MatchingToggle refreshKey={today?.generatedAtIso} onChanged={() => void reload()} /> : null}
      <Notices error={error} missingLine={view.missingLine} loading={!today && loading} onRetry={() => void reload()} />
      {saveNote ? (
        <p role="alert" className={styles.noticeQuiet}>
          {saveNote}
        </p>
      ) : null}
      {muteNote ? (
        <p role="status" className={styles.noticeQuiet}>
          {muteNote}
        </p>
      ) : null}
      {today ? <Timeline viewerId={accountId} view={view} marks={marks} mark={mark} toggle={toggle} onSave={save} onMute={(card) => void mute(card)} onChanged={() => void reload()} /> : null}
    </>
  );
}
