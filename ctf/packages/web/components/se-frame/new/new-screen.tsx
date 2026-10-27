'use client';

import { SE_NEW_LATER, SE_TALK_WORDS } from '@ctf/shared';
import { TalkForm } from './talk-form';
import styles from './new.module.css';

// + New: what a member can start. Talk books a TI Radio slot in the Main Room. Ask, Offer and Story
// are built with the rest of + New.

export function NewScreen() {
  return (
    <>
      <section className={styles.card} aria-labelledby="se-new-talk">
        <h2 id="se-new-talk" className={styles.cardTitle}>
          {SE_TALK_WORDS.title}
        </h2>
        <p className={styles.text}>{SE_TALK_WORDS.intro}</p>
        <TalkForm />
      </section>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{SE_NEW_LATER.title}</h2>
        <p className={styles.text}>{SE_NEW_LATER.text}</p>
      </section>
    </>
  );
}
