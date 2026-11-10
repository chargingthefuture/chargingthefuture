'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SE_TODAY_ROOM_WORDS as W, seTalkTimes, seWeekDays, type SeTodayTalk } from '@ctf/shared';
import styles from './today.module.css';

// The week strip on Today, to the approved board: Monday to Sunday of the reader's own week, today
// filled in. A day with a talk booked in the Main Room carries a dot; choosing a day says what is
// booked that day. Days already gone cannot be chosen.
export function WeekStrip({ talks }: { talks: SeTodayTalk[] }) {
  const days = seWeekDays(talks);
  const [picked, setPicked] = useState<string | null>(null);
  const shown = days.find((day) => day.key === picked) ?? null;
  return (
    <>
      <nav aria-label={W.weekLabel} className={styles.week}>
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            className={styles.weekDay}
            aria-label={day.label}
            aria-pressed={picked === day.key}
            aria-current={day.today ? 'date' : undefined}
            disabled={day.past}
            onClick={() => setPicked((value) => (value === day.key ? null : day.key))}
          >
            <span className={styles.weekLetter}>{day.letter}</span>
            <span className={`${styles.weekDate} ${day.today ? styles.weekToday : ''} ${picked === day.key ? styles.weekPicked : ''}`}>{day.date}</span>
            <span className={day.talks.length > 0 ? styles.weekDot : styles.weekNoDot} aria-hidden="true" />
          </button>
        ))}
      </nav>
      {shown ? (
        <div className={styles.weekPanel} role="status">
          <span className={styles.weekPanelDay}>{shown.label}</span>
          {shown.talks.length === 0 ? <span className={styles.roomMeta}>{W.noTalks}</span> : null}
          {shown.talks.map((talk) => (
            <span key={talk.startIso} className={styles.weekTalk}>
              <b>{talk.title}</b> · {talk.host} · {seTalkTimes(talk)}
            </span>
          ))}
        </div>
      ) : null}
      <Link href={W.bookPath} className={styles.weekBook}>
        {W.book}
      </Link>
    </>
  );
}
