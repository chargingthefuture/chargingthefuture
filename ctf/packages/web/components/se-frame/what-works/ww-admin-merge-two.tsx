'use client';

import { useState } from 'react';
import { SE_WW_ADMIN_WORDS as W } from '@ctf/shared';
import { reasonText } from 'lib/errors/client-failure';
import { wwAdminPost } from './use-ww-pending';
import styles from './ww-admin.module.css';

// Two problems already on the list that are the same problem. Everything under the first, with
// every vote on it, moves to the second, and the first is removed.

export type WwListedProblem = { id: string; title: string };

type Props = { listed: WwListedProblem[]; onMerged: () => Promise<void> };

function Pick({ id, label, value, onChange, listed, skip }: { id: string; label: string; value: string; onChange: (_v: string) => void; listed: WwListedProblem[]; skip: string }) {
  return (
    <>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{W.choose}</option>
        {listed
          .filter((p) => p.id !== skip)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
      </select>
    </>
  );
}

export function WwAdminMergeTwo({ listed, onMerged }: Props) {
  const [fromId, setFromId] = useState('');
  const [intoId, setIntoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const merge = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await wwAdminPost<{ moved?: number }>(`/api/what-works/admin/problems/${fromId}/merge`, { intoId });
      setFromId('');
      setIntoId('');
      setNote({ kind: 'ok', text: W.merged(result.moved ?? 0) });
      await onMerged();
    } catch (error) {
      setNote({ kind: 'error', text: reasonText(error) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={styles.card} aria-labelledby="se-ww-merge-two">
      <p id="se-ww-merge-two" className={styles.problem}>
        {W.allTitle}
      </p>
      <p className={styles.note}>{W.allText}</p>
      <Pick id="se-ww-merge-from" label={W.mergeFrom} value={fromId} onChange={setFromId} listed={listed} skip={intoId} />
      <Pick id="se-ww-merge-into" label={W.mergeTo} value={intoId} onChange={setIntoId} listed={listed} skip={fromId} />
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={busy || !fromId || !intoId} onClick={() => void merge()}>
          {W.mergeTwo}
        </button>
      </div>
      {note ? (
        <p role={note.kind === 'error' ? 'alert' : 'status'} className={note.kind === 'error' ? styles.error : styles.note}>
          {note.text}
        </p>
      ) : null}
    </article>
  );
}
