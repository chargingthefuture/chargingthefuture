'use client';

import { useState } from 'react';
import { SE_ASK_WORDS as W, seAskSuggestions, type SeAskSuggestion } from '@ctf/shared';
import styles from './new.module.css';
import sheet from './sheet.module.css';
import { AskTasks, SuggestionText, useAskTasks } from './ask-tasks';

// + New → Ask: posted as a public SocketRelay request with no place on it, through the route
// SocketRelay's own form uses. Suggestions from the holiday list appear while typing.

const MAX_TITLE = 120;
const MAX_DETAILS = 5000;

async function postAsk(title: string, details: string, tag: string): Promise<void> {
  const res = await fetch('/api/socket-relay/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ title, details, tags: [tag], isPublic: true, idempotencyKey: crypto.randomUUID() }),
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  throw new Error(typeof body?.message === 'string' ? body.message : `${W.failed} (HTTP ${res.status})`);
}

function Suggestions({ typed, onPick }: { typed: string; onPick: (_item: SeAskSuggestion) => void }) {
  const items = seAskSuggestions(typed);
  if (items.length === 0) return null;
  return (
    <div className={sheet.suggestList} role="group" aria-label={W.suggestions}>
      {items.map((item) => (
        <button key={item.text} type="button" className={sheet.suggestItem} onClick={() => onPick(item)}>
          <SuggestionText typed={typed} text={item.text} />
        </button>
      ))}
    </div>
  );
}

export function AskForm() {
  const [title, setTitle] = useState('');
  const goal = useAskTasks();
  const [details, setDetails] = useState('');
  const [tag, setTag] = useState(W.defaultTag);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postAsk(title.trim(), details.trim(), tag);
      setPosted(true);
      setTitle('');
      setDetails('');
      setTag(W.defaultTag);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : W.failed);
    } finally {
      setBusy(false);
    }
  }

  // With small tasks the ask is posted as a goal on the member's PeerProgramming board instead.
  async function submitGoal(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const failure = await goal.post(title.trim());
    setBusy(false);
    if (failure) return setError(failure);
    setTitle('');
    setDetails('');
    setTag(W.defaultTag);
  }

  const disabled = busy || !title.trim();
  return (
    <form className={styles.form} onSubmit={(event) => void (goal.tasks ? submitGoal(event) : submit(event))}>
      {posted ? (
        <p role="status" className={styles.done}>
          {W.posted}
        </p>
      ) : null}
      <label className={styles.label} htmlFor="se-ask-title">
        {W.what}
      </label>
      <input id="se-ask-title" className={`${styles.input} ${sheet.pill}`} value={title} maxLength={MAX_TITLE} onChange={(event) => setTitle(event.target.value)} required />
      <Suggestions
        typed={title}
        onPick={(item) => {
          setTitle(item.text);
          setTag(item.group);
        }}
      />
      <label className={styles.label} htmlFor="se-ask-details">
        {W.details} <span className={sheet.optional}>{W.optional}</span>
      </label>
      <textarea
        id="se-ask-details"
        className={`${styles.input} ${sheet.area}`}
        rows={2}
        value={details}
        maxLength={MAX_DETAILS}
        aria-describedby="se-ask-hint"
        onChange={(event) => setDetails(event.target.value)}
        disabled={goal.tasks !== null}
      />
      <p id="se-ask-hint" className={styles.text}>
        {W.hint}
      </p>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <AskTasks state={goal} />
      <button type="submit" className={styles.submit} disabled={disabled}>
        {busy ? W.submitting : W.submit}
      </button>
    </form>
  );
}
