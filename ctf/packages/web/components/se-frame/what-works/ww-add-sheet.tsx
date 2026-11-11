'use client';

import { useEffect, useState } from 'react';
import { SE_WW_ADD_WORDS as W, seWwHelpedCount } from '@ctf/shared';
import { responseFailureText, reasonText } from 'lib/errors/client-failure';
import { seThemeVars } from '../se-theme-vars';
import { useSeTheme } from '../use-se-theme';
import { useWwSimilar, WW_MIN_QUERY, type WwMatchState } from './use-ww-similar';
import styles from './ww-add-sheet.module.css';

// What Works, add a problem: the member types the problem, sees the problems already on the list
// that share words with it, and either uses one or adds theirs, which waits for review.

export type WwAddedProblem = { id: string; title: string };

type Props = {
  onClose: () => void;
  onUse: (_problemId: string) => void;
  onAddWhatHelped: (_problem: WwAddedProblem) => void;
};

async function sendProblem(title: string): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/what-works/problems', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return { ok: false, message: await responseFailureText(res, `The problem could not be saved (HTTP ${res.status}).`, 'member') };
    const body = (await res.json()) as { problemId?: string };
    return body.problemId ? { ok: true, id: body.problemId } : { ok: false, message: 'The problem was saved but the answer named no problem. Reload the list.' };
  } catch (error) {
    return { ok: false, message: `The problem could not be saved: ${reasonText(error)}.` };
  }
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Matches({ state, onUse }: { state: WwMatchState; onUse: (_id: string) => void }) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'loading') return <p className={styles.note}>{W.searching}</p>;
  if (state.kind === 'error') return <p role="alert" className={styles.error}>{W.matchesFailed(state.reason)}</p>;
  if (state.matches.length === 0) return <p className={styles.note}>{W.noMatches}</p>;
  return (
    <div className={styles.matches}>
      <span className={styles.label}>{W.matchesLabel}</span>
      {state.matches.map((m) => (
        <button key={m.id} type="button" className={styles.match} onClick={() => onUse(m.id)}>
          <span className={styles.matchText}>
            <span className={styles.matchTitle}>{m.title}</span>
            <span className={styles.matchCount}>{seWwHelpedCount(m.helpedCount)}</span>
          </span>
          <span className={styles.use}>{W.useThis}</span>
        </button>
      ))}
    </div>
  );
}

function Sent({ problem, onAddWhatHelped, onClose }: { problem: WwAddedProblem; onAddWhatHelped: Props['onAddWhatHelped']; onClose: () => void }) {
  return (
    <>
      <h2 className={styles.title}>{W.sentTitle}</h2>
      <p role="status" className={styles.rule}>
        {W.sent}
      </p>
      <span className={styles.spacer} />
      <button type="button" className={styles.primary} onClick={() => onAddWhatHelped(problem)}>
        {W.addWhatHelped}
      </button>
      <button type="button" className={styles.add} onClick={onClose}>
        {W.done}
      </button>
    </>
  );
}

function AddForm({ onUse, onSent }: { onUse: (_id: string) => void; onSent: (_p: WwAddedProblem) => void }) {
  const [title, setTitle] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = useWwSimilar(title);
  const hasMatches = matches.kind === 'ready' && matches.matches.length > 0;
  const add = async () => {
    const clean = title.trim();
    if (clean.length < WW_MIN_QUERY) return setError(W.tooShort);
    setSending(true);
    setError(null);
    const result = await sendProblem(clean);
    setSending(false);
    if (!result.ok) return setError(result.message);
    onSent({ id: result.id, title: clean });
  };
  return (
    <>
      <h1 className={styles.title}>{W.title}</h1>
      <p className={styles.rule}>{W.rule}</p>
      <div className={styles.field}>
        <label htmlFor="se-ww-problem" className={styles.label}>
          {W.label}
        </label>
        <input id="se-ww-problem" type="text" className={styles.input} value={title} maxLength={120} autoComplete="off" onChange={(e) => setTitle(e.target.value)} />
      </div>
      <Matches state={matches} onUse={onUse} />
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <span className={styles.spacer} />
      <button type="button" className={styles.add} disabled={sending} onClick={() => void add()}>
        {sending ? W.sending : hasMatches ? W.addIt : W.addItEmpty}
      </button>
    </>
  );
}

export function WwAddSheet({ onClose, onUse, onAddWhatHelped }: Props) {
  const { theme } = useSeTheme();
  const [sent, setSent] = useState<WwAddedProblem | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.backdrop} style={seThemeVars(theme.color, theme.mode)}>
      <section role="dialog" aria-modal="true" aria-label={W.title} className={styles.sheet}>
        <div className={styles.top}>
          <button type="button" className={styles.close} aria-label={W.close} onClick={onClose}>
            <CloseIcon />
          </button>
          <span className={styles.eyebrow}>{W.eyebrow}</span>
        </div>
        {sent ? <Sent problem={sent} onAddWhatHelped={onAddWhatHelped} onClose={onClose} /> : <AddForm onUse={onUse} onSent={setSent} />}
      </section>
    </div>
  );
}
