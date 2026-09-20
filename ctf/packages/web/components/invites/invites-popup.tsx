'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './invites-popup.module.css';

// One of the blog's published invite posts at a time, in a small card that floats in the corner of
// every signed-out plugin page. It replaces the reviews popup (owner decision, 2026-09-19): the one
// review on that list linked to a Quora post that no longer exists, and a card for somebody already
// listed in the Directory says more about what this is than a quote about it does.
//
// It floats rather than sitting in the page flow (owner report, 2026-09-20). Rendered first inside
// the page it read as the plugin's own first section — a visitor arriving at Chyme met a block of
// invitations before anything about Chyme, and on a phone that block was most of the screen. A
// fixed corner card is read as an aside, the way the reviews popup it replaced was, and it takes no
// vertical space from the plugin under it.
//
// The list is the blog's own build output, invites.json, written from the invite posts themselves
// and served by GitHub Pages with an open CORS header. Nothing here decides what an invite is; the
// blog does. Renders nothing when the file cannot be read or is empty.
//
// Nothing moves on its own. The visitor advances with the two buttons or the keyboard, dismisses it
// for the session with the close control, and the card stays in the page for a screen reader.

const INVITES_URL = 'https://chargingthefuture.github.io/chargingthefuture/invites.json';
const DISMISS_KEY = 'ctf-invites-popup-dismissed';
const APPEAR_DELAY_MS = 2500;

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

// The blog's file, unless the visitor closed the card earlier in this session. The dismissal check
// sits at the top of the effect so a later `endpoint` change cannot re-open a closed card.
function useInvites(endpoint: string): { invites: InviteCard[]; visible: boolean; hide: () => void } {
  const [invites, setInvites] = useState<InviteCard[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* private mode — treat it as not dismissed */
    }
    if (dismissed) return;
    let canceled = false;
    // Held out here so the one cleanup below can clear it; a cleanup returned from inside .then()
    // would go to the promise chain rather than to useEffect.
    let appearTimer: number | undefined;
    fetch(endpoint, { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : { invites: [] }))
      .then((data: { invites?: InviteCard[] }) => {
        if (canceled) return;
        const list = Array.isArray(data.invites) ? data.invites : [];
        if (list.length === 0) return;
        setInvites(list);
        appearTimer = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
      })
      .catch(() => {
        /* additive: no file, no card */
      });
    return () => {
      canceled = true;
      if (appearTimer !== undefined) window.clearTimeout(appearTimer);
    };
  }, [endpoint]);

  function hide() {
    setVisible(false);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode — the dismissal simply does not persist */
    }
  }

  return { invites, visible, hide };
}

export function InvitesPopup({ endpoint = INVITES_URL }: { endpoint?: string }) {
  const { invites, visible, hide } = useInvites(endpoint);
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!visible || invites.length === 0) return null;

  const invite = invites[index];

  function step(direction: -1 | 1) {
    setIndex((at) => (at + direction + invites.length) % invites.length);
    cardRef.current?.focus();
  }

  return (
    <aside className={styles.wrap} aria-label="Open invitations to people in the Directory">
      <div className={styles.card} ref={cardRef} tabIndex={-1}>
        <button type="button" className={styles.close} onClick={hide} aria-label="Close the invitations">
          ×
        </button>
        <span className={styles.eyebrow}>People already on the list</span>
        <div aria-live="polite">
          <span className={styles.date}>{formatDate(invite.date)}</span>
          <h2 className={styles.title}>{invite.title}</h2>
          <p className={styles.opening}>{invite.opening}</p>
        </div>
        <div className={styles.foot}>
          <a className={styles.link} href={invite.url} rel="noopener noreferrer">
            Read the invitation →
          </a>
          {invites.length > 1 ? (
            <span className={styles.buttons}>
              <span className={styles.count}>
                {index + 1}/{invites.length}
              </span>
              <button type="button" className={styles.btn} onClick={() => step(-1)} aria-label="Show the previous invitation">
                ‹
              </button>
              <button type="button" className={styles.btn} onClick={() => step(1)} aria-label="Show the next invitation">
                ›
              </button>
            </span>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
