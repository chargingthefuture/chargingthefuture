'use client';

import { useState } from 'react';
import { TI_RADIO_MAX_TITLE_LENGTH } from 'lib/ti-radio/constants';
import {
  SE_TALK_WORDS as W,
  seSlotDay,
  seTalkBooked,
  seTalkDays,
  seTalkFirstOpenDay,
  seTalkPickedSpan,
  seTalkRow,
  type SeTalkDay,
  type SeTalkSlot,
} from '@ctf/shared';
import { requestJson } from '@/components/ti-radio/ti-radio-shared';
import styles from './new.module.css';
import sheet from './sheet.module.css';

// + New → Talk, to the approved board "Schedule a talk": the seven days from today, every 90 minutes
// on the chosen day (open ones dashed and free to take, booked ones with their title and host), and
// the topic for the one picked.

function DayStrip({ days, day, onDay }: { days: SeTalkDay[]; day: string | null; onDay: (_key: string) => void }) {
  return (
    <div role="group" aria-label={W.days} className={sheet.days}>
      {days.map((item) => (
        <button key={item.key} type="button" aria-label={item.label} aria-pressed={item.key === day} className={sheet.day} onClick={() => onDay(item.key)}>
          <span className={sheet.dayLetter}>{item.letter}</span>
          <span className={sheet.dayDate}>{item.date}</span>
        </button>
      ))}
    </div>
  );
}

function SlotList({ slots, picked, onPick }: { slots: SeTalkSlot[]; picked: string | null; onPick: (_slot: SeTalkSlot) => void }) {
  if (!slots.some((slot) => slot.state === 'open' && !slot.isOnAir)) return <p className={sheet.sub}>{W.noneThisDay}</p>;
  return (
    <ul aria-label={W.slots} className={sheet.slots}>
      {slots.map((slot) => {
        const row = seTalkRow(slot, picked);
        const body = (
          <>
            <span className={sheet.slotTime}>{row.time}</span>
            <span className={sheet.slotText}>
              <span className={sheet.slotTitle}>{row.title}</span>
              <span className={sheet.slotSub}>{row.sub}</span>
            </span>
          </>
        );
        return (
          <li key={slot.slotStartIso}>
            {row.pickable ? (
              <button type="button" aria-pressed={row.look === 'picked'} className={`${sheet.slot} ${sheet[row.look]}`} onClick={() => onPick(slot)}>
                {body}
              </button>
            ) : (
              <div className={`${sheet.slot} ${sheet.booked}`}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// The day on show: the one chosen, else the first.
function shownDay(days: SeTalkDay[], key: string | null): { key: string | null; slots: SeTalkSlot[] } {
  const day = days.find((item) => item.key === key) ?? days[0];
  return day ? { key: day.key, slots: day.slots } : { key: null, slots: [] };
}

// The picked slot, the topic, and booking it through the TI Radio guide's own route.
function useBooking(reload: () => Promise<void>) {
  const [picked, setPicked] = useState<SeTalkSlot | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!picked || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson('/api/ti-radio/slots', { method: 'POST', body: JSON.stringify({ slotStart: picked.slotStartIso, title: title.trim() }) });
      setBooked(picked.slotStartIso);
      setTitle('');
      setPicked(null);
      await reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : W.failed);
    } finally {
      setBusy(false);
    }
  }
  return { picked, setPicked, title, setTitle, busy, error, booked, submit };
}

function AboutLabel({ picked }: { picked: SeTalkSlot | null }) {
  return (
    <label className={styles.label} htmlFor="se-talk-title">
      {W.about} <span className={sheet.optional}>{picked ? seTalkPickedSpan(picked.slotStartIso, picked.slotEndIso) : W.pickFirst}</span>
    </label>
  );
}

export function TalkBook({ slots, reload }: { slots: SeTalkSlot[]; reload: () => Promise<void> }) {
  const days = seTalkDays(slots);
  const [day, setDay] = useState<string | null>(() => seTalkFirstOpenDay(days));
  const { picked, setPicked, title, setTitle, busy, error, booked, submit } = useBooking(reload);
  const shown = shownDay(days, day);
  const pickedIso = picked ? picked.slotStartIso : null;

  return (
    <form className={sheet.talkForm} onSubmit={(event) => void submit(event)}>
      {booked ? (
        <p role="status" className={styles.done}>
          {seTalkBooked(seSlotDay(booked))}
        </p>
      ) : null}
      <DayStrip days={days} day={shown.key} onDay={setDay} />
      <SlotList slots={shown.slots} picked={pickedIso} onPick={setPicked} />
      <AboutLabel picked={picked} />
      <input
        id="se-talk-title"
        className={`${styles.input} ${sheet.pill}`}
        placeholder={W.aboutPlaceholder}
        value={title}
        maxLength={TI_RADIO_MAX_TITLE_LENGTH}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={busy || !picked || !title.trim()}>
        {busy ? W.submitting : W.submit}
      </button>
    </form>
  );
}
