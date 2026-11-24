'use client';

import { useState } from 'react';
import { SE_WW_ADD_WORDS, SE_WW_HELPED_WORDS as W, seWwHelpedBody, seWwHelpedReady } from '@ctf/shared';
import { responseFailureText } from 'lib/errors/client-failure';
import { seThemeVars } from '../se-theme-vars';
import { useSheetFocus } from '../use-sheet-focus';
import { useSeTheme } from '../use-se-theme';
import { SheetTop } from '../sheet/sheet-top';
import type { WwAddedProblem } from './ww-add-sheet';
import styles from './ww-add-sheet.module.css';

// "What helped", in the sheet opened from the What works card on Today: after Use this or Add what
// helped, the member names the product, its purchase link and why it works, and it goes to review
// through the same route the 3.0 suggest form uses. It stays in 3.1, drawn like the add sheet.

type Draft = { name: string; purchaseUrl: string; note: string };

async function sendHelped(problemId: string, draft: Draft): Promise<string | null> {
  try {
    const res = await fetch('/api/what-works/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(seWwHelpedBody({ problemId, ...draft })),
    });
    return res.ok ? null : await responseFailureText(res, W.failed, 'member');
  } catch {
    return W.failed;
  }
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
    </div>
  );
}

function HelpedForm({ problem, onSent }: { problem: WwAddedProblem; onSent: () => void }) {
  const [draft, setDraft] = useState<Draft>({ name: '', purchaseUrl: '', note: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const send = async () => {
    setSending(true);
    const failure = await sendHelped(problem.id, draft);
    setSending(false);
    if (failure) return setError(failure);
    onSent();
  };
  return (
    <>
      <h1 className={styles.title}>{W.title}</h1>
      <p className={styles.rule}>{W.forProblem(problem.title)}</p>
      <Field id="se-ww-name" label={W.name}>
        <input id="se-ww-name" type="text" className={styles.input} value={draft.name} maxLength={120} onChange={set('name')} />
      </Field>
      <Field id="se-ww-link" label={W.link}>
        <input id="se-ww-link" type="url" inputMode="url" className={styles.input} value={draft.purchaseUrl} maxLength={2048} placeholder="https://…" onChange={set('purchaseUrl')} />
      </Field>
      <Field id="se-ww-note" label={W.note}>
        <textarea id="se-ww-note" className={styles.textarea} value={draft.note} maxLength={400} onChange={set('note')} />
      </Field>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <span className={styles.spacer} />
      <button type="button" className={styles.primary} disabled={sending || !seWwHelpedReady({ problemId: problem.id, ...draft })} onClick={() => void send()}>
        {sending ? W.sending : W.send}
      </button>
    </>
  );
}

function HelpedSent({ onClose }: { onClose: () => void }) {
  return (
    <>
      <h2 className={styles.title}>{W.sentTitle}</h2>
      <p role="status" className={styles.rule}>
        {W.sent}
      </p>
      <span className={styles.spacer} />
      <button type="button" className={styles.add} onClick={onClose}>
        {W.done}
      </button>
    </>
  );
}

export function WwHelpedSheet({ problem, onClose }: { problem: WwAddedProblem; onClose: () => void }) {
  const { theme } = useSeTheme();
  const [sent, setSent] = useState(false);
  const dialog = useSheetFocus(onClose);
  return (
    <div className={styles.backdrop} style={seThemeVars(theme.color, theme.mode)}>
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={W.title} className={styles.sheet}>
        <SheetTop className={styles.top} closeClassName={styles.close} closeLabel={SE_WW_ADD_WORDS.close} onClose={onClose}>
          <span className={styles.eyebrow}>{SE_WW_ADD_WORDS.eyebrow}</span>
        </SheetTop>
        {sent ? <HelpedSent onClose={onClose} /> : <HelpedForm problem={problem} onSent={() => setSent(true)} />}
      </section>
    </div>
  );
}
