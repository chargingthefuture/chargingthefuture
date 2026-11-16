'use client';

import { useEffect, useState } from 'react';
import { SE_UNLOCK_SCREEN_WORDS as W } from '@ctf/shared';
import { seUnlockPost } from './use-unlock-screen';
import styles from './unlock-screen.module.css';

// The two other ways to finish Unlock, for a member whose Quora account was removed: finish with a
// removed account they reported in the Quora census (the same route as the 3.0 page), or bring their
// Quora writing into the Knowledge Library. The census and the Knowledge Library stay on their 3.0
// pages: the census by owner decision (each member fills it in once), the Knowledge Library because
// 3.1 has no screen for it yet.

type RemovedBody = { ok?: boolean; removedAccounts?: { handle: string }[]; message?: string };

function useRemovedHandles(): { handles: string[] | null; readError: string | null } {
  const [handles, setHandles] = useState<string[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  useEffect(() => {
    let canceled = false;
    void (async () => {
      const res = await fetch('/api/quora-deletion-survey/verification', { cache: 'no-store' }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as RemovedBody | null;
      if (canceled) return;
      if (!res?.ok || !body?.ok) setReadError(`${W.removedReadFailed}: ${body?.message ?? 'the server did not answer'}.`);
      setHandles((body?.removedAccounts ?? []).map((account) => account.handle));
    })();
    return () => {
      canceled = true;
    };
  }, []);
  return { handles, readError };
}

export function UnlockRemovedRoutes({ onFinished }: { onFinished: () => void }) {
  const { handles, readError } = useRemovedHandles();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function finishWith(handle: string) {
    setBusy(handle);
    const failed = await seUnlockPost('/api/quora-deletion-survey/verification', { removedHandle: handle }, W.finishFailed);
    setBusy(null);
    setError(failed);
    if (!failed) onFinished();
  }

  return (
    <section className={styles.card} aria-labelledby="se-unlock-removed">
      <h2 id="se-unlock-removed" className={styles.sectionTitle}>
        {W.removedTitle}
      </h2>
      <p className={styles.text}>{W.removedText}</p>
      {handles === null ? <p className={styles.note}>{W.removedLoading}</p> : null}
      {handles && handles.length > 0 ? (
        <div className={styles.chips}>
          {handles.map((handle) => (
            <button key={handle} type="button" className={styles.secondary} disabled={busy !== null} onClick={() => void finishWith(handle)}>
              {busy === handle ? W.sending : W.finishWith(handle)}
            </button>
          ))}
        </div>
      ) : null}
      {handles && handles.length === 0 ? (
        <p className={styles.text}>
          {W.censusLead}{' '}
          <a href={W.censusHref} className={styles.link}>
            {W.census}
          </a>
          {W.censusTail}
        </p>
      ) : null}
      <p className={styles.text}>
        {W.knowledgeLead}{' '}
        <a href={W.knowledgeHref} className={styles.link}>
          {W.knowledge}
        </a>
        {W.knowledgeTail}
      </p>
      {[readError, error].filter(Boolean).map((message) => (
        <p key={message} role="alert" className={styles.error}>
          {message}
        </p>
      ))}
    </section>
  );
}
