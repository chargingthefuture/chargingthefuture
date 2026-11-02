'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SE_ARCHITECT_MAX_QUESTION, SE_ARCHITECT_WORDS as W, seAgo, type SeArchitectItem } from '@ctf/shared';
import { useArchitect } from './use-architect';
import styles from './new.module.css';

// + New → Ask the architect: the 3.1 home of the 3.0 chat's @comic assistant. The member asks here
// and sees their questions below, each marked being checked until a person approves the answer.

function Rating({ item, onRate }: { item: SeArchitectItem; onRate: (_rating: 'helpful' | 'not_helpful') => Promise<string | null> }) {
  const [note, setNote] = useState<string | null>(null);
  if (!item.answerTurnId) return null;
  const press = async (rating: 'helpful' | 'not_helpful') => setNote((await onRate(rating)) ?? W.rated);
  return (
    <div className={styles.choices}>
      <button type="button" className={styles.chip} aria-pressed={item.currentUserRating === 'helpful'} onClick={() => void press('helpful')}>
        {W.helpful}
      </button>
      <button type="button" className={styles.chip} aria-pressed={item.currentUserRating === 'not_helpful'} onClick={() => void press('not_helpful')}>
        {W.notHelpful}
      </button>
      {note ? (
        <span role="status" className={styles.text}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

function Item({ item, onRate }: { item: SeArchitectItem; onRate: (_turnId: string, _rating: 'helpful' | 'not_helpful') => Promise<string | null> }) {
  return (
    <div className={styles.choice}>
      <span className={styles.choiceTitle}>{item.question}</span>
      <span className={styles.text}>
        {item.status === 'pending' ? W.pending : item.answer} · {seAgo(item.askedAtIso)}
      </span>
      {item.linkedPlugins.length > 0 ? (
        <span className={styles.choices}>
          {item.linkedPlugins.map((plugin) => (
            <Link key={plugin.slug} href={`/apps/${plugin.slug}`} className={styles.chip}>
              {plugin.name}
            </Link>
          ))}
        </span>
      ) : null}
      {item.status === 'answered' ? <Rating item={item} onRate={(rating) => onRate(item.answerTurnId as string, rating)} /> : null}
    </div>
  );
}

export function ArchitectSection() {
  const { items, loadError, ask, rate } = useArchitect();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const failure = await ask(question);
    setBusy(false);
    if (failure) return setError(failure);
    setSent(true);
    setQuestion('');
  }

  return (
    <>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        {sent ? (
          <p role="status" className={styles.done}>
            {W.sent}
          </p>
        ) : null}
        <label className={styles.label} htmlFor="se-architect-question">
          {W.question}
        </label>
        <textarea
          id="se-architect-question"
          className={styles.input}
          rows={3}
          value={question}
          maxLength={SE_ARCHITECT_MAX_QUESTION}
          onChange={(event) => setQuestion(event.target.value)}
          required
        />
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.submit} disabled={busy || !question.trim()}>
          {busy ? W.submitting : W.submit}
        </button>
      </form>
      {loadError ? (
        <p role="alert" className={styles.error}>
          {loadError}
        </p>
      ) : null}
      {items === null && !loadError ? <p className={styles.text}>{W.loading}</p> : null}
      {items && items.length > 0 ? (
        <div className={styles.choices} aria-label={W.yours}>
          {items.map((item) => (
            <Item key={item.questionTurnId} item={item} onRate={rate} />
          ))}
        </div>
      ) : null}
    </>
  );
}
