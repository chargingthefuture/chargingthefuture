'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SeTodayCard } from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import styles from './today.module.css';

// One card in Today. Tapping the text opens it in place; the buttons open the item where it lives.
// The ••• menu holds Copy link and Hide; mute and report join it with the safety controls.

function absolute(href: string): string {
  return href.startsWith('http') ? href : `${window.location.origin}${href}`;
}

function CardMenu({ card, onHide }: { card: SeTodayCard; onHide: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absolute(card.href));
      setCopied(true);
    } catch {
      // no-trace: the browser refused the clipboard; the link stays on the card's own button.
      setCopied(false);
    }
  };
  return (
    <div className={styles.menuWrap}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="More: copy link, hide"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => void copy()}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={onHide}>
            Hide
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TodayCard({
  card,
  read,
  onRead,
  onHide,
}: {
  card: SeTodayCard;
  read: boolean;
  onRead: () => void;
  onHide: () => void;
}) {
  const [open, setOpen] = useState(false);
  const color = `var(--se-kind-${card.kind})`;
  const toggle = () => {
    setOpen((value) => !value);
    onRead();
  };
  return (
    <article className={styles.card}>
      <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
      <div className={styles.cardHead}>
        {card.author ? <SeAvatar accountId={card.author.accountId} size={28} /> : null}
        {card.author ? <span className={styles.handle}>{card.author.handle}</span> : null}
        <span className={styles.label} style={{ color }}>
          {card.label}
        </span>
        <span className={styles.spacer} />
        {read ? (
          <span className={styles.check} role="img" aria-label="Read" style={{ background: color }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--se-bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5 9-10" />
            </svg>
          </span>
        ) : null}
        <CardMenu card={card} onHide={onHide} />
      </div>
      <button type="button" className={styles.textButton} aria-expanded={open} onClick={toggle}>
        <span className={styles.cardTitle}>{card.title}</span>
        {card.body ? <span className={open ? styles.body : `${styles.body} ${styles.bodyClosed}`}>{card.body}</span> : null}
      </button>
      {card.actions.length > 0 ? (
        <div className={styles.actions}>
          {card.actions.map((item) => (
            <Link key={item.kind + item.label} href={item.href} className={styles.actionButton} onClick={onRead}>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
