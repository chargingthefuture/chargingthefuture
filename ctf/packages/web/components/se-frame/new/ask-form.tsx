'use client';

import { useState } from 'react';
import {
  SE_ASK_DUE_CHOICES,
  SE_ASK_WORDS as W,
  SE_CARD_LIFETIME_WORDS as L,
  seAskDueIso,
  seAskSuggestions,
  type SeAskDue,
  type SeAskSuggestion,
} from '@ctf/shared';
import styles from './new.module.css';

// + New → Ask: posted as a public SocketRelay request with no place on it, through the route
// SocketRelay's own form uses. Suggestions from the holiday list appear while typing. "By when?" is
// optional: a deadline keeps the ask on Today until then; with none it stays 14 days and can be
// kept up longer.

const MAX_TITLE = 120;
const MAX_DETAILS = 5000;

async function postAsk(title: string, details: string, tag: string, dueIso: string | null): Promise<void> {
  const res = await fetch('/api/socket-relay/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ title, details, tags: [tag], isPublic: true, idempotencyKey: crypto.randomUUID(), dueIso }),
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  throw new Error(typeof body?.message === 'string' ? body.message : `${W.failed} (HTTP ${res.status})`);
}

function Suggestions({ typed, onPick }: { typed: string; onPick: (_item: SeAskSuggestion) => void }) {
  const items = seAskSuggestions(typed);
  if (items.length === 0) return null;
  return (
    <div className={styles.suggestions} aria-label={W.suggestions}>
      {items.map((item) => (
        <button key={item.text} type="button" className={styles.chip} onClick={() => onPick(item)}>
          {item.text}
        </button>
      ))}
    </div>
  );
}

function ByWhen({ due, date, onDue, onDate }: { due: SeAskDue; date: string; onDue: (_due: SeAskDue) => void; onDate: (_date: string) => void }) {
  return (
    <fieldset className={styles.byWhen}>
      <legend className={styles.label}>{L.byWhen}</legend>
      <div className={styles.suggestions}>
        {SE_ASK_DUE_CHOICES.map((choice) => (
          <button key={choice.key} type="button" aria-pressed={due === choice.key} className={due === choice.key ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => onDue(choice.key)}>
            {choice.label}
          </button>
        ))}
      </div>
      {due === 'date' ? (
        <>
          <label className={styles.label} htmlFor="se-ask-date">
            {L.date}
          </label>
          <input id="se-ask-date" type="date" className={styles.input} value={date} onChange={(event) => onDate(event.target.value)} />
        </>
      ) : null}
      <p className={styles.text}>{L.byWhenHint}</p>
    </fieldset>
  );
}

export function AskForm() {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [tag, setTag] = useState(W.defaultTag);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [due, setDue] = useState<SeAskDue>('none');
  const [date, setDate] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const dueIso = seAskDueIso(due, date || null);
    if (due === 'date' && !dueIso) {
      setError(L.dateMissing);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postAsk(title.trim(), details.trim(), tag, dueIso);
      setPosted(true);
      setTitle('');
      setDetails('');
      setTag(W.defaultTag);
      setDue('none');
      setDate('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : W.failed);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !title.trim() || !details.trim();
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      {posted ? (
        <p role="status" className={styles.done}>
          {W.posted}
        </p>
      ) : null}
      <label className={styles.label} htmlFor="se-ask-title">
        {W.what}
      </label>
      <input id="se-ask-title" className={styles.input} value={title} maxLength={MAX_TITLE} onChange={(event) => setTitle(event.target.value)} required />
      <Suggestions
        typed={title}
        onPick={(item) => {
          setTitle(item.text);
          setTag(item.group);
        }}
      />
      <label className={styles.label} htmlFor="se-ask-details">
        {W.details}
      </label>
      <textarea
        id="se-ask-details"
        className={styles.input}
        rows={3}
        value={details}
        maxLength={MAX_DETAILS}
        aria-describedby="se-ask-hint"
        onChange={(event) => setDetails(event.target.value)}
        required
      />
      <p id="se-ask-hint" className={styles.text}>
        {W.hint}
      </p>
      <ByWhen due={due} date={date} onDue={setDue} onDate={setDate} />
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={disabled}>
        {busy ? W.submitting : W.submit}
      </button>
    </form>
  );
}
