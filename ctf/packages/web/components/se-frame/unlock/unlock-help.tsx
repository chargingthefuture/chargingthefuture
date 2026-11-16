'use client';

import { useId, useState } from 'react';
import { SE_UNLOCK_SCREEN_WORDS as W } from '@ctf/shared';
import { QUORA_URL_HELP_IMAGE, QUORA_URL_HELP_ORDER, QUORA_URL_HELP_STEPS } from 'lib/unlock/quora-url-help-steps';
import { UNLOCK_QUORA_HINT_MAX_LENGTH } from 'lib/unlock/quora-hint';
import { seUnlockPost } from './use-unlock-screen';
import styles from './unlock-screen.module.css';

// "Can't find it?": the steps and picture the 3.0 page shows, the box for anything that helps find
// the member on Quora, and the help request (POST /api/unlock/help-request), which stops the count.
// In 3.0 the request also took the member to the Commons; 3.1 stays on this screen and says it was sent.

function Steps() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? W.hideSteps : W.showSteps}
      </button>
      {open ? (
        <div className={styles.steps}>
          {/* A plain img: a static SVG in /public, which next/image would not resize anyway. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={QUORA_URL_HELP_IMAGE.src} alt={QUORA_URL_HELP_IMAGE.alt} width={640} height={400} className={styles.picture} />
          {QUORA_URL_HELP_ORDER.map((key) => (
            <div key={key}>
              <h3 className={styles.stepHeading}>{QUORA_URL_HELP_STEPS[key].heading}</h3>
              <ol className={styles.stepList}>
                {QUORA_URL_HELP_STEPS[key].steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function UnlockHelp({ onAsked }: { onAsked: () => void }) {
  const id = useId();
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    const failed = await seUnlockPost('/api/unlock/help-request', { quoraHint: hint.trim() }, W.askFailed);
    setBusy(false);
    setError(failed);
    setSent(!failed);
    if (!failed) onAsked();
  }

  return (
    <section className={styles.card} aria-labelledby="se-unlock-help">
      <h2 id="se-unlock-help" className={styles.sectionTitle}>
        {W.helpTitle}
      </h2>
      <p className={styles.text}>{W.helpText}</p>
      <Steps />
      <label htmlFor={id} className={styles.label}>
        {W.hintLabel}
      </label>
      <input id={id} className={styles.field} value={hint} maxLength={UNLOCK_QUORA_HINT_MAX_LENGTH} placeholder={W.hintPlaceholder} onChange={(e) => setHint(e.target.value)} />
      <p className={styles.small}>{W.hintNote}</p>
      <button type="button" className={styles.primary} disabled={busy} onClick={() => void ask()}>
        {busy ? W.asking : W.ask}
      </button>
      {sent ? (
        <p role="status" className={styles.note}>
          {W.asked}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
