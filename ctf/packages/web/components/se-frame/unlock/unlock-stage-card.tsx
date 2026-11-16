'use client';

import { useId, useState } from 'react';
import { SE_UNLOCK_SCREEN_WORDS as W, SE_UNLOCK_WORDS, seUnlockSendCard, type SeUnlockStage, type SeUnlockStanding } from '@ctf/shared';
import { seUnlockPost } from './use-unlock-screen';
import styles from './unlock-screen.module.css';

// Where the member stands. While nothing is sent, the card is the Unlock banner's own (approved
// boards "Unlock banner, day 9 of 14" and "After the Unlock deadline"): the day count, its title and
// words, and the address box. After that it says waiting, approved, or that the address needs
// another look, with a box to send a new one.

type Props = { stage: SeUnlockStage; standing: SeUnlockStanding | null; helpAsked: boolean; onSent: () => void; onToday: () => void };

export function UnlockStageCard({ stage, standing, helpAsked, onSent, onToday }: Props) {
  if (stage === 'send') return <SendCard standing={standing} helpAsked={helpAsked} onSent={onSent} />;
  if (stage === 'waiting') {
    return (
      <section className={styles.card} aria-label={W.waitingTitle}>
        <h2 className={styles.cardTitle}>{W.waitingTitle}</h2>
        <p className={styles.text}>{W.waitingText}</p>
      </section>
    );
  }
  if (stage === 'approved') {
    return (
      <section className={styles.card} aria-label={W.approvedTitle}>
        <h2 className={styles.cardTitle}>{W.approvedTitle}</h2>
        <p className={styles.text}>{W.approvedText}</p>
        <p className={styles.note}>{W.approvedCredits}</p>
        <button type="button" className={styles.primary} onClick={onToday}>
          {W.backToToday}
        </button>
      </section>
    );
  }
  return (
    <section className={styles.card} aria-label={W.anotherLookTitle}>
      <h2 className={styles.cardTitle}>{W.anotherLookTitle}</h2>
      <p className={styles.text}>{W.anotherLookText}</p>
      <AddressForm label={W.resend} onSent={onSent} />
    </section>
  );
}

function SendCard({ standing, helpAsked, onSent }: { standing: SeUnlockStanding | null; helpAsked: boolean; onSent: () => void }) {
  const card = seUnlockSendCard(standing);
  return (
    <section className={card.pick ? styles.pickCard : styles.card} aria-label={card.title}>
      {card.dayLabel ? (
        <div className={styles.dayRow}>
          <span className={styles.day}>{card.dayLabel}</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${card.progressPercent}%` }} />
          </span>
        </div>
      ) : null}
      <h2 className={styles.cardTitle}>{card.title}</h2>
      {card.text ? <p className={styles.text}>{card.text}</p> : null}
      {helpAsked ? <p className={styles.text}>{W.helpAsked}</p> : null}
      <AddressForm label={W.label} onSent={onSent} />
      <p className={styles.small}>{W.publicNote}</p>
    </section>
  );
}

function AddressForm({ label, onSent }: { label: string; onSent: () => void }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    const failed = await seUnlockPost('/api/unlock/submission', { quoraProfileUrl: value.trim() }, W.sendFailed);
    setBusy(false);
    setError(failed);
    if (!failed) onSent();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.row}>
        <input id={id} type="url" inputMode="url" autoComplete="url" className={styles.input} placeholder={SE_UNLOCK_WORDS.placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className={styles.add} disabled={busy || !value.trim()}>
          {busy ? W.sending : W.send}
        </button>
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
