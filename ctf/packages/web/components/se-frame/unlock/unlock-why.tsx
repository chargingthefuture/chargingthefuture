'use client';

import { useState } from 'react';
import { SE_UNLOCK_SCREEN_WORDS as W } from '@ctf/shared';
import styles from './unlock-screen.module.css';

// Why the step exists (the banner's "Why this step"), what opens once approved, and what gets an
// account banned, closed until opened, as on the 3.0 page: not finishing is not one of them.
export function UnlockWhy() {
  const [banOpen, setBanOpen] = useState(false);
  return (
    <>
      <section className={styles.sunk} aria-labelledby="se-unlock-why">
        <h2 id="se-unlock-why" className={styles.sectionTitle}>
          {W.whyTitle}
        </h2>
        {W.why.map((item) => (
          <div key={item.title} className={styles.whyItem}>
            <span className={styles.whyTitle}>{item.title}</span>
            <span className={styles.text}>{item.text}</span>
          </div>
        ))}
      </section>
      <section className={styles.sunk} aria-labelledby="se-unlock-opens">
        <h2 id="se-unlock-opens" className={styles.sectionTitle}>
          {W.opensTitle}
        </h2>
        <ul className={styles.opens}>
          {W.opens.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section className={styles.sunk} aria-label={W.banTitle}>
        <button type="button" className={styles.banToggle} aria-expanded={banOpen} onClick={() => setBanOpen((value) => !value)}>
          <span>{W.banTitle}</span>
          <span className={styles.soft}>{banOpen ? W.hide : W.read}</span>
        </button>
        {banOpen ? W.ban.map((line) => <p key={line} className={styles.text}>{line}</p>) : null}
      </section>
    </>
  );
}
