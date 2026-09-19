'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './invites-strip.module.css';

// A row of the blog's published invite posts, one card each, newest first, shown at the top of
// every signed-out plugin page. It replaces the reviews popup (owner decision, 2026-09-19): the
// one review on that list linked to a Quora post that no longer exists, and a card for somebody
// already listed in the Directory says more about what this is than a quote about it does.
//
// The list is the blog's own build output, invites.json, written from the invite posts
// themselves and served by GitHub Pages with an open CORS header. Nothing here decides what an
// invite is; the blog does. Renders nothing when the file cannot be read or is empty.
//
// Nothing moves on its own. The row scrolls by touch, by the two buttons, or by keyboard, and
// every card is in the page for a screen reader.

const INVITES_URL = 'https://chargingthefuture.github.io/chargingthefuture/invites.json';

type InviteCard = {
  name: string;
  title: string;
  url: string;
  date: string;
  opening: string;
};

function formatDate(iso: string): string {
  const at = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function InvitesStrip({ endpoint = INVITES_URL }: { endpoint?: string }) {
  const [invites, setInvites] = useState<InviteCard[]>([]);
  const rowRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let canceled = false;
    fetch(endpoint, { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : { invites: [] }))
      .then((data: { invites?: InviteCard[] }) => {
        if (canceled) return;
        setInvites(Array.isArray(data.invites) ? data.invites : []);
      })
      .catch(() => {
        /* additive: no file, no row */
      });
    return () => {
      canceled = true;
    };
  }, [endpoint]);

  if (invites.length === 0) return null;

  function scrollByCard(direction: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    const card = row.querySelector<HTMLElement>('li');
    const step = card ? card.getBoundingClientRect().width + 12 : row.clientWidth * 0.9;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row.scrollBy({ left: direction * step, behavior: reduce ? 'auto' : 'smooth' });
  }

  return (
    <section className={styles.wrap} aria-labelledby="invites-strip-heading">
      <div className={styles.head}>
        <div>
          <h2 id="invites-strip-heading" className={styles.title}>
            People already on the list
          </h2>
          <p className={styles.lede}>Open invitations to people listed in the Directory, written in public.</p>
        </div>
        {invites.length > 1 ? (
          <div className={styles.buttons}>
            <button type="button" className={styles.btn} onClick={() => scrollByCard(-1)} aria-label="Show the previous invitations">
              ‹
            </button>
            <button type="button" className={styles.btn} onClick={() => scrollByCard(1)} aria-label="Show the next invitations">
              ›
            </button>
          </div>
        ) : null}
      </div>
      <ul ref={rowRef} className={styles.row} aria-label={`${invites.length} invitations, newest first`}>
        {invites.map((invite) => (
          <li key={invite.url} className={styles.card}>
            <span className={styles.date}>{formatDate(invite.date)}</span>
            <h3 className={styles.cardTitle}>{invite.title}</h3>
            <p className={styles.opening}>{invite.opening}</p>
            <a className={styles.link} href={invite.url} rel="noopener noreferrer">
              Read the invitation →
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
