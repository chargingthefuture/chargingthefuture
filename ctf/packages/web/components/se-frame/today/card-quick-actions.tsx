'use client';

import { useState } from 'react';
import { SE_SAVED_WORDS, SE_TODAY_MOOD_WORDS, SE_TODAY_MOODS, type SeTodayCard } from '@ctf/shared';
import { getMoodClientId } from '@/components/mood/mood-shared';
import styles from './today.module.css';

// The controls a Today card carries in its own row (approved board): Save for later and Hide as
// icons on a story or replay, and the Mood card's five faces, each of which is the check-in.

export function SaveHideIcons({ card, onSave, onHide }: { card: SeTodayCard; onSave: () => void; onHide: () => void }) {
  const saved = card.saved === true;
  return (
    <>
      <span className={styles.spacer} />
      <button
        type="button"
        className={saved ? `${styles.iconButton} ${styles.iconButtonOn}` : styles.iconButton}
        aria-pressed={saved}
        aria-label={saved ? SE_SAVED_WORDS.unsave : SE_SAVED_WORDS.save}
        onClick={onSave}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 4h12v16l-6-4-6 4z" />
        </svg>
      </button>
      <button type="button" className={styles.iconButton} aria-label={SE_SAVED_WORDS.hide} onClick={onHide}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.2M6.6 6.6C4.4 8.1 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 4-1" />
        </svg>
      </button>
    </>
  );
}

async function checkIn(value: number): Promise<string | null> {
  const res = await fetch('/api/mood/submissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ clientId: getMoodClientId() || `today-${Date.now()}`, moodValue: value, note: null }),
  }).catch(() => null);
  if (res?.ok) return null;
  const body = (await res?.json().catch(() => null)) as { message?: string } | null;
  return `${SE_TODAY_MOOD_WORDS.failed} ${body?.message ?? (res ? `HTTP ${res.status}` : 'The app could not be reached.')}`;
}

export function MoodFaces() {
  const [chosen, setChosen] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const pick = async (value: number) => {
    setChosen(value);
    setState('saving');
    setError(null);
    const failure = await checkIn(value);
    setError(failure);
    setState(failure ? 'idle' : 'saved');
  };
  const label = SE_TODAY_MOODS.find((mood) => mood.value === chosen)?.label ?? '';
  return (
    <>
      <div className={styles.moodFaces} role="group" aria-label="How is today?">
        {SE_TODAY_MOODS.map((mood) => (
          <button
            key={mood.value}
            type="button"
            className={chosen === mood.value ? `${styles.moodFace} ${styles.moodFaceOn}` : styles.moodFace}
            aria-pressed={chosen === mood.value}
            disabled={state !== 'idle'}
            onClick={() => void pick(mood.value)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d={mood.mouth} />
            </svg>
            <span className={styles.moodFaceLabel}>{mood.label}</span>
          </button>
        ))}
      </div>
      {state === 'saving' ? <p className={styles.noticeQuiet}>{SE_TODAY_MOOD_WORDS.saving}</p> : null}
      {state === 'saved' ? (
        <p role="status" className={styles.noticeQuiet}>
          {SE_TODAY_MOOD_WORDS.saved(label)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={styles.noticeQuiet}>
          {error}
        </p>
      ) : null}
    </>
  );
}
