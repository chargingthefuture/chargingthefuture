'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { SE_UNLOCK_WORDS as W, type SeUnlockStanding } from '@ctf/shared';
import styles from './unlock-banner.module.css';

// The Unlock banner on every 3.1 screen, for a member not approved yet, built to the approved boards
// "Unlock banner, day 9 of 14" and "After the Unlock deadline": the day count, the address box, the
// two other ways to finish, and, after day 14, that posting is paused. It can be closed only in the
// first week, and only until the next visit. An approved member never sees it.
export function UnlockBanner() {
  const [standing, setStanding] = useState<SeUnlockStanding | null>(null);
  const [closed, setClosed] = useState(false);

  const load = useCallback(() => {
    fetch('/api/unlock/standing', { cache: 'no-store' })
      .then(async (res) => ((await res.json().catch(() => null)) as { standing?: SeUnlockStanding } | null)?.standing ?? null)
      .then(setStanding)
      .catch(() => {
        // no-trace: without the standing the banner stays away; every gated route still says why.
      });
  }, []);

  useEffect(load, [load]);

  if (!standing || standing.approved || closed) return null;
  return <Banner standing={standing} onClose={() => setClosed(true)} onSent={load} />;
}

function Banner({ standing, onClose, onSent }: { standing: SeUnlockStanding; onClose: () => void; onSent: () => void }) {
  const paused = standing.paused;
  return (
    <section aria-label={paused ? 'Paused until Unlock' : 'Finish Unlock'} className={paused ? styles.paused : styles.banner}>
      <TopRow standing={standing} onClose={onClose} />
      <p className={styles.title}>{standing.title}</p>
      <p className={styles.text}>{standing.text}</p>
      {standing.form ? <AddressForm label={paused ? W.pausedLabel : W.label} onSent={onSent} /> : null}
      {standing.form && !paused ? <OtherRoutes onSent={onSent} /> : null}
      {paused ? <HelpButton label={W.askArchitect} className={styles.askLink} onSent={onSent} /> : null}
    </section>
  );
}

function TopRow({ standing, onClose }: { standing: SeUnlockStanding; onClose: () => void }) {
  if (!standing.dayLabel && !standing.closable) return null;
  return (
    <div className={styles.top}>
      {standing.dayLabel ? (
        <>
          <span className={styles.day}>{standing.dayLabel}</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${Math.round(standing.progress * 100)}%` }} />
          </span>
        </>
      ) : (
        <span className={styles.spacer} />
      )}
      {standing.closable ? (
        <button type="button" className={styles.close} onClick={onClose}>
          {W.close}
        </button>
      ) : null}
    </div>
  );
}

// POST the profile address to the same route the Unlock screen uses. The route checks the address
// and answers with what was wrong; the banner shows that, or a plain retry line.
async function sendAddress(quoraProfileUrl: string): Promise<string | null> {
  try {
    const res = await fetch('/api/unlock/submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ quoraProfileUrl }),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return body?.message ?? W.addFailed;
  } catch {
    return W.addFailed;
  }
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
    const failed = await sendAddress(value.trim());
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
        <input id={id} type="url" inputMode="url" autoComplete="url" className={styles.input} placeholder={W.placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className={styles.add} disabled={busy}>
          {busy ? W.adding : W.add}
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

function OtherRoutes({ onSent }: { onSent: () => void }) {
  return (
    <>
      <p className={styles.small}>
        <b>{W.removedLead}</b> {W.removedText}{' '}
        <Link href={W.censusHref} className={styles.link}>
          {W.census}
        </Link>{' '}
        {W.or}{' '}
        <Link href={W.knowledgeHref} className={styles.link}>
          {W.knowledge}
        </Link>
        .
      </p>
      <p className={styles.smaller}>
        {W.countLine}{' '}
        <Link href={W.href} className={styles.link}>
          {W.why}
        </Link>{' '}
        · <HelpButton label={W.cantFind} className={styles.linkButton} onSent={onSent} />
      </p>
    </>
  );
}

// "Can't find it?" asks for help finding the address: the same request the Unlock screen sends,
// which stops the count and opens the Commons so there is somebody to ask.
function HelpButton({ label, className, onSent }: { label: string; className: string; onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function ask() {
    setBusy(true);
    const res = await fetch('/api/unlock/help-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({}),
    }).catch(() => null);
    setBusy(false);
    setError(!res?.ok);
    if (res?.ok) onSent();
  }

  return (
    <>
      <button type="button" className={className} onClick={() => void ask()} disabled={busy}>
        {busy ? W.asking : label}
      </button>
      {error ? (
        <span role="alert" className={styles.error}>
          {' '}
          {W.addFailed}
        </span>
      ) : null}
    </>
  );
}
