'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TI_RADIO_MAX_DESCRIPTION_LENGTH, TI_RADIO_MAX_TITLE_LENGTH } from 'lib/ti-radio/constants';
import type { TiRadioGuide } from 'lib/ti-radio/types';
import { SE_TALK_WORDS as W, seSlotDay, seSlotLabel, seTalkBooked } from '@ctf/shared';
import { requestJson } from '@/components/ti-radio/ti-radio-shared';
import styles from './new.module.css';

// + New → Talk: book an empty 90 minutes on TI Radio, held in the Chyme Main Room. The same routes
// the TI Radio guide uses, so the same rules apply (Unlock approval, the per-day limit, no overlap).

type GuideState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; guide: TiRadioGuide };

function useGuide() {
  const [state, setState] = useState<GuideState>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const payload = await requestJson<{ guide: TiRadioGuide }>('/api/ti-radio/guide');
      setState({ kind: 'ready', guide: payload.guide });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not read the TI Radio schedule.' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

function NotYet() {
  return (
    <p className={styles.text}>
      {W.needsUnlock} <Link href="/plugin/unlock">{W.finishUnlock}</Link>
    </p>
  );
}

export function TalkForm() {
  const { state, reload } = useGuide();
  if (state.kind === 'loading') return <p className={styles.text}>{W.loading}</p>;
  if (state.kind === 'error') {
    return (
      <p role="alert" className={styles.error}>
        {state.message}{' '}
        <button type="button" className={styles.linkButton} onClick={() => void reload()}>
          {W.tryAgain}
        </button>
      </p>
    );
  }
  if (!state.guide.viewer.canHost) return <NotYet />;
  return <TalkFields guide={state.guide} reload={reload} />;
}

function TalkFields({ guide, reload }: { guide: TiRadioGuide; reload: () => Promise<void> }) {
  const [slot, setSlot] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  const open = guide.slots.filter((item) => item.state === 'open' && !item.isOnAir);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!slot || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson('/api/ti-radio/slots', {
        method: 'POST',
        body: JSON.stringify({ slotStart: slot, title: title.trim(), description: description.trim() }),
      });
      setBooked(slot);
      setTitle('');
      setDescription('');
      setSlot('');
      await reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not book the talk.');
    } finally {
      setBusy(false);
    }
  }

  if (open.length === 0 && !booked) return <p className={styles.text}>{W.noOpen}</p>;

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      {booked ? (
        <p role="status" className={styles.done}>
          {seTalkBooked(seSlotDay(booked))}
        </p>
      ) : null}
      <label className={styles.label} htmlFor="se-talk-slot">
        {W.when}
      </label>
      <select id="se-talk-slot" className={styles.input} value={slot} onChange={(event) => setSlot(event.target.value)} required>
        <option value="">{W.choose}</option>
        {open.map((item) => (
          <option key={item.slotStartIso} value={item.slotStartIso}>
            {seSlotLabel(item.slotStartIso, item.slotEndIso)}
          </option>
        ))}
      </select>
      <label className={styles.label} htmlFor="se-talk-title">
        {W.about}
      </label>
      <input
        id="se-talk-title"
        className={styles.input}
        value={title}
        maxLength={TI_RADIO_MAX_TITLE_LENGTH}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <label className={styles.label} htmlFor="se-talk-description">
        {W.detail}
      </label>
      <textarea
        id="se-talk-description"
        className={styles.input}
        rows={3}
        value={description}
        maxLength={TI_RADIO_MAX_DESCRIPTION_LENGTH}
        onChange={(event) => setDescription(event.target.value)}
      />
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={busy || !slot || !title.trim()}>
        {busy ? W.submitting : W.submit}
      </button>
    </form>
  );
}
