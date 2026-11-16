'use client';

import { useState, type FormEvent } from 'react';
import { SE_MATCH_NEEDS, SE_MATCH_WORDS as W, seMatchCode, type SeMatchChange, type SeMatchState } from '@ctf/shared';
import { useMatchCard } from './use-match-card';
import styles from './match-card.module.css';

// The Match card on Today (owner decision, 2026-11-16), built to the Match card on the approved Today
// board: "Match", a big number, "people fit what you need" and Get introduced, which opens People on
// "Fits what you need". Until the member has picked something it asks "What do you need today?" with
// the landing page's need chips, or takes a code saved on lagatos.com. The number is counted live on
// every read. Approved members only: for anybody else the card is not drawn.

const PEOPLE_FITS_HREF = '/?tab=people&filter=fits';

function Dot() {
  return (
    <span className={styles.dot} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.5-4.5" />
      </svg>
    </span>
  );
}

type Save = (_change: SeMatchChange) => Promise<string | null>;

function CodeForm({ busy, onSave }: { busy: boolean; onSave: Save }) {
  const [code, setCode] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normal = seMatchCode(code);
    if (!normal) return setNote(W.badCode);
    setNote(await onSave({ kind: 'code', code: normal }));
  };
  return (
    <form className={styles.codeForm} onSubmit={(event) => void submit(event)}>
      <label className={styles.codeLabel} htmlFor="se-match-code">
        {W.codeLabel}
      </label>
      <div className={styles.codeRow}>
        <input
          id="se-match-code"
          className={styles.codeInput}
          value={code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={W.codePlaceholder}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="submit" className={styles.button} disabled={busy || code.trim() === ''}>
          {W.useCode}
        </button>
      </div>
      {note ? (
        <p role="alert" className={styles.note}>
          {note}
        </p>
      ) : null}
    </form>
  );
}

type PickerProps = { initial: string[]; onSave: Save; onCancel?: () => void };

function Picker({ initial, onSave, onCancel }: PickerProps) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const toggle = (key: string) => setPicked((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]));
  const save: Save = async (change) => {
    setBusy(true);
    const failed = await onSave(change);
    setBusy(false);
    return failed;
  };
  return (
    <>
      <span className={styles.ask}>{W.ask}</span>
      <div className={styles.chips} role="group" aria-label={W.needsLabel}>
        {SE_MATCH_NEEDS.map((need) => (
          <button key={need.key} type="button" aria-pressed={picked.includes(need.key)} className={styles.chip} onClick={() => toggle(need.key)}>
            {need.label}
          </button>
        ))}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || picked.length === 0}
          onClick={() => void save({ kind: 'needs', needKeys: picked }).then(setNote)}
        >
          {busy ? W.saving : W.show}
        </button>
        {onCancel ? (
          <button type="button" className={styles.button} onClick={onCancel}>
            {W.cancel}
          </button>
        ) : null}
      </div>
      {note ? (
        <p role="alert" className={styles.note}>
          {note}
        </p>
      ) : null}
      <CodeForm busy={busy} onSave={save} />
    </>
  );
}

function Count({ match, onIntroduce, onChange }: { match: SeMatchState; onIntroduce: () => void; onChange: () => void }) {
  const count = match.count;
  return (
    <>
      {count === null ? <span className={styles.line}>{W.noCount}</span> : <span className={styles.big}>{count}</span>}
      {count === null ? null : <span className={styles.line}>{W.fit(count)}</span>}
      {count ? (
        <a
          href={PEOPLE_FITS_HREF}
          className={styles.link}
          onClick={(event) => {
            event.preventDefault();
            onIntroduce();
          }}
        >
          {W.introduce}
        </a>
      ) : null}
      <button type="button" className={styles.textButton} onClick={onChange}>
        {W.change}
      </button>
    </>
  );
}

function Body({ match, onSave, onIntroduce }: { match: SeMatchState; onSave: Save; onIntroduce: () => void }) {
  const [editing, setEditing] = useState(false);
  const needs = match.needs;
  if (!needs || editing) {
    const save: Save = async (change) => {
      const failed = await onSave(change);
      if (!failed) setEditing(false);
      return failed;
    };
    return <Picker initial={needs?.needKeys ?? []} onSave={save} onCancel={needs ? () => setEditing(false) : undefined} />;
  }
  return <Count match={match} onIntroduce={onIntroduce} onChange={() => setEditing(true)} />;
}

export function MatchCard({ refreshKey, onIntroduce }: { refreshKey?: string; onIntroduce: () => void }) {
  const { state, retry, save } = useMatchCard(refreshKey);
  if (state.kind === 'hidden') return null;
  return (
    <article className={styles.card} aria-label={W.label}>
      <Dot />
      <span className={styles.label}>{W.label}</span>
      {state.kind === 'loading' ? <span className={styles.line}>{W.loading}</span> : null}
      {state.kind === 'error' ? (
        <div role="alert" className={styles.errorRow}>
          <span className={styles.line}>
            {state.message}
          </span>
          <button type="button" className={styles.button} onClick={retry}>
            {W.tryAgain}
          </button>
        </div>
      ) : null}
      {state.kind === 'ready' ? <Body match={state.match} onSave={save} onIntroduce={onIntroduce} /> : null}
    </article>
  );
}
