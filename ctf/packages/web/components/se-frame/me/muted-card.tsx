'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_MUTE_WORDS as W, type SeMute } from '@ctf/shared';
import styles from './me.module.css';

// Me → Muted: the people and words this member muted, each with Unmute, and a box to mute words.

const CSRF = { 'content-type': 'application/json', 'x-ctf-csrf': '1' };

async function readMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return `${W.failed} ${body?.message ?? `(HTTP ${res.status})`}`;
}

function useMutes() {
  const [mutes, setMutes] = useState<SeMute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch('/api/account/mutes', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return setError(res ? await readMessage(res) : W.failed);
    setMutes(((await res.json()) as { mutes: SeMute[] }).mutes);
    setError(null);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const send = useCallback(
    async (request: Promise<Response | null>) => {
      const res = await request;
      if (!res?.ok) return setError(res ? await readMessage(res) : W.failed);
      await load();
    },
    [load],
  );
  return { mutes, error, load, send };
}

export function MutedCard() {
  const { mutes, error, send } = useMutes();
  const [words, setWords] = useState('');
  const add = () => {
    if (!words.trim()) return;
    void send(fetch('/api/account/mutes', { method: 'POST', headers: CSRF, body: JSON.stringify({ kind: 'words', target: words }) }).catch(() => null));
    setWords('');
  };
  const remove = (id: string) => void send(fetch(`/api/account/mutes/${id}`, { method: 'DELETE', headers: CSRF }).catch(() => null));
  return (
    <section className={styles.card} aria-labelledby="se-me-muted">
      <p id="se-me-muted" className={styles.label}>
        {W.title}
      </p>
      <p className={styles.text}>{W.intro}</p>
      {mutes.length === 0 ? <p className={styles.text}>{W.empty}</p> : null}
      {mutes.map((mute) => (
        <div key={mute.id} className={styles.row}>
          <span className={styles.muteItem}>{mute.kind === 'person' ? (mute.label ?? 'A member') : `“${mute.target}”`}</span>
          <button type="button" className={styles.pillButton} onClick={() => remove(mute.id)}>
            {W.remove}
          </button>
        </div>
      ))}
      <div className={styles.row}>
        <input
          className={styles.wordsInput}
          aria-label={W.addWords}
          placeholder={W.addPlaceholder}
          value={words}
          maxLength={60}
          onChange={(event) => setWords(event.target.value)}
        />
        <button type="button" className={styles.pillButton} onClick={add} disabled={!words.trim()}>
          {W.add}
        </button>
      </div>
      {error ? (
        <p role="alert" className={styles.text}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
