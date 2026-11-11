'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SE_SAVED_WORDS as W, seSavedKindName, type SeSavedCard } from '@ctf/shared';
import styles from './saved-card.module.css';

// Me → Saved: the stories and replays this member saved for later from Today (GET /api/today/saves),
// newest first, each linking to where it lives, with Remove. Read from the server, so every device
// shows the same list.

async function failure(res: Response | null, lead: string): Promise<string> {
  if (!res) return `${lead} the app could not be reached.`;
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return `${lead} ${body?.message ?? `HTTP ${res.status}`}`;
}

function useSaves() {
  const [saves, setSaves] = useState<SeSavedCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch('/api/today/saves', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return setError(await failure(res, W.loadFailed));
    setSaves(((await res.json()) as { saves: SeSavedCard[] }).saves);
    setError(null);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const remove = useCallback(
    async (cardId: string) => {
      const res = await fetch('/api/today/saves', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ cardId, saved: false }),
      }).catch(() => null);
      if (!res?.ok) return setError(await failure(res, W.failed));
      await load();
    },
    [load],
  );
  return { saves, error, remove };
}

function SavedLink({ save }: { save: SeSavedCard }) {
  const label = (
    <>
      <span className={styles.kind}>{seSavedKindName(save.kind)}</span>
      <span className={styles.title}>{save.title}</span>
    </>
  );
  return save.href.startsWith('/') ? (
    <Link href={save.href} className={styles.link}>
      {label}
    </Link>
  ) : (
    <a href={save.href} target="_blank" rel="noreferrer" className={styles.link}>
      {label}
    </a>
  );
}

export function SavedCard() {
  const { saves, error, remove } = useSaves();
  return (
    <section className={styles.card} aria-labelledby="se-me-saved">
      <p id="se-me-saved" className={styles.label}>
        {W.title}
      </p>
      <p className={styles.text}>{W.intro}</p>
      {saves === null && !error ? <p className={styles.text}>Loading…</p> : null}
      {saves?.length === 0 ? <p className={styles.text}>{W.empty}</p> : null}
      {saves?.map((save) => (
        <div key={save.cardId} className={styles.row}>
          <SavedLink save={save} />
          <button type="button" className={styles.remove} onClick={() => void remove(save.cardId)}>
            {W.remove}
          </button>
        </div>
      ))}
      {error ? (
        <p role="alert" className={styles.text}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
