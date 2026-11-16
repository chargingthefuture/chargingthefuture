'use client';

import { useState } from 'react';
import { SE_PERSON_SHEET_WORDS as W, type SeQuoteProvider } from '@ctf/shared';
import { PersonSheetFrame } from './person-sheet-frame';
import { sendQuoteRequest, useQuoteProvider } from './use-person-sheets';
import styles from './person-sheet.module.css';

// Request a quote, opened in place from People: the Foundation flow in the 3.1 look. It reads what
// the person offers from Foundation's provider route and sends the request the way the Foundation
// screens do (open a connection, then request the quote on it). Every state the Foundation profile
// has: reading, a failed read, the button, Requesting…, the own-profile note, the failure and the
// confirmation.

type Send = { kind: 'idle' } | { kind: 'sending' } | { kind: 'failed'; message: string } | { kind: 'sent' };

function Details({ provider }: { provider: SeQuoteProvider }) {
  return (
    <>
      <div className={styles.who}>
        <h2 className={styles.name}>{provider.displayName}</h2>
        {provider.headline ? <span className={styles.headline}>{provider.headline}</span> : null}
      </div>
      {provider.shortDescription ? <p className={styles.bio}>{provider.shortDescription}</p> : null}
      {provider.offeredSkills.length > 0 ? (
        <section className={styles.section} aria-label={W.offers}>
          <h3 className={styles.label}>{W.offers}</h3>
          <div className={styles.chips}>
            {provider.offeredSkills.map((skill) => (
              <span key={skill} className={styles.offer}>
                {skill}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {provider.bio ? (
        <section className={styles.section} aria-label={W.about}>
          <h3 className={styles.label}>{W.about}</h3>
          <p className={styles.bio}>{provider.bio}</p>
        </section>
      ) : null}
      <div className={styles.note}>
        <strong>{W.goodToKnow}</strong> {W.goodToKnowText}
      </div>
    </>
  );
}

function Offer({ provider, viewerUserId }: { provider: SeQuoteProvider; viewerUserId: string | null }) {
  const [send, setSend] = useState<Send>({ kind: 'idle' });
  const own = viewerUserId !== null && viewerUserId === provider.providerUserId;
  const disabled = own || send.kind === 'sending' || send.kind === 'sent';
  const submit = () => {
    setSend({ kind: 'sending' });
    sendQuoteRequest(provider)
      .then(() => setSend({ kind: 'sent' }))
      .catch((error: unknown) => setSend({ kind: 'failed', message: error instanceof Error ? error.message : W.requestFailed }));
  };
  return (
    <>
      <Details provider={provider} />
      <button type="button" className={styles.primary} disabled={disabled} aria-busy={send.kind === 'sending'} onClick={submit}>
        {send.kind === 'sending' ? W.requesting : W.request}
      </button>
      {own ? <p className={styles.soft}>{W.ownProfile}</p> : null}
      <p role="status" aria-live="polite" className={styles.done}>
        {send.kind === 'failed' ? send.message : null}
        {send.kind === 'sent' ? W.requested(provider.displayName) : null}
      </p>
    </>
  );
}

export function QuoteSheet({ profileId, name, onClose }: { profileId: string; name: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const read = useQuoteProvider(profileId, attempt);
  return (
    <PersonSheetFrame title={W.quoteTitle} label={W.openQuote(name)} onClose={onClose}>
      {read.kind === 'loading' ? (
        <p className={styles.soft} role="status">
          {W.loadingProvider}
        </p>
      ) : null}
      {read.kind === 'failed' ? (
        <p role="alert" className={styles.soft}>
          {read.message}{' '}
          <button type="button" className={styles.textButton} onClick={() => setAttempt((n) => n + 1)}>
            {W.tryAgain}
          </button>
        </p>
      ) : null}
      {read.kind === 'ready' ? <Offer provider={read.value.provider} viewerUserId={read.value.viewerUserId} /> : null}
    </PersonSheetFrame>
  );
}
