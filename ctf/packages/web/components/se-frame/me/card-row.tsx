'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { seCardOpensSheet, seOpens30Page, type SeTodayCard } from '@ctf/shared';
import styles from './me.module.css';

// One card in a Me list (Open, Read, Hidden). A card that opens a sheet on Today opens it in place
// here too; any other links to where it lives, and a 3.0 page is never opened.
export function CardRow({ card, onSheet, children }: { card: SeTodayCard; onSheet: (_card: SeTodayCard) => void; children: ReactNode }) {
  if (seCardOpensSheet(card)) {
    return (
      <button type="button" className={`${styles.listItem} ${styles.rowButton}`} onClick={() => onSheet(card)}>
        {children}
      </button>
    );
  }
  if (seOpens30Page(card.href)) return <div className={styles.listItem}>{children}</div>;
  return (
    <Link href={card.href} className={styles.listItem}>
      {children}
    </Link>
  );
}
