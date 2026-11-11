'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './settings.module.css';

// The rows of 3.1 Settings (approved board "Settings"): a label, its current value and a chevron.
// A row is a button, an in-app link or an outside link, whichever it does.

function Chevron() {
  return (
    <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

type RowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  href?: string;
  external?: boolean;
  pressed?: boolean;
  expanded?: boolean;
};

export function SettingsRow({ label, value, onPress, href, external, pressed, expanded }: RowProps) {
  const inner = (
    <>
      <span className={styles.rowLabel}>{label}</span>
      {value ? <span className={styles.rowValue}>{value}</span> : null}
      <Chevron />
    </>
  );
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={styles.row}>
        {inner}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={styles.row}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.row} aria-pressed={pressed} aria-expanded={expanded} onClick={onPress}>
      {inner}
    </button>
  );
}

export function SettingsGroup({ title, children, after }: { title?: string; children: ReactNode; after?: ReactNode }) {
  return (
    <section className={styles.group}>
      {title ? <h2 className={styles.groupTitle}>{title}</h2> : null}
      <div className={styles.box}>{children}</div>
      {after}
    </section>
  );
}
