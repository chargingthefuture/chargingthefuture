'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_MATCHING_WORDS as W, seMatchingToggleShown, type SeMatchingState } from '@ctf/shared';
import styles from './matching-toggle.module.css';

// 21 Questions matching, on or off: under Matches on Today and on Me. Shows nothing until the member
// has answered a question, or when they cannot use 21 Questions. Only this toggle changes matching;
// answering never turns it back on. `refreshKey` reads it again (Today passes its own read time, so
// the toggle appears right after the first answer); `onChanged` lets Today read its cards again.

const URL = '/api/today/questions/matching';

function useMatching(refreshKey: string | undefined) {
  const [state, setState] = useState<SeMatchingState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch(URL, { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return setState(null);
    const data = (await res.json().catch(() => null)) as SeMatchingState | null;
    setState(data ? { answered: data.answered, enabled: data.enabled } : null);
  }, []);
  useEffect(() => void load(), [load, refreshKey]);
  const set = async (enabled: boolean): Promise<boolean> => {
    setBusy(true);
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ enabled }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as (SeMatchingState & { message?: string }) | null;
    setBusy(false);
    if (!res?.ok || !data) {
      setNote(`${W.failed} ${data?.message ?? 'the app could not be reached.'}`);
      return false;
    }
    setNote(null);
    setState({ answered: data.answered, enabled: data.enabled });
    return true;
  };
  return { state, note, busy, set };
}

export function MatchingToggle({ refreshKey, onChanged }: { refreshKey?: string; onChanged?: () => void }) {
  const { state, note, busy, set } = useMatching(refreshKey);
  if (!state || !seMatchingToggleShown(state)) return null;
  const change = async (enabled: boolean) => {
    if (await set(enabled)) onChanged?.();
  };
  return (
    <section className={styles.card} aria-label={W.title}>
      <label className={styles.row}>
        <span className={styles.toggleText}>{W.toggle}</span>
        <input
          type="checkbox"
          role="switch"
          className={styles.switch}
          checked={state.enabled}
          disabled={busy}
          onChange={(event) => void change(event.target.checked)}
        />
      </label>
      <p className={styles.hint}>{W.hint}</p>
      {note ? (
        <p role="alert" className={styles.hint}>
          {note}
        </p>
      ) : null}
    </section>
  );
}
