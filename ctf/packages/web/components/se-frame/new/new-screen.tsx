'use client';

import Link from 'next/link';
import { SE_ASK_WORDS, SE_OFFER_CHOICES, SE_OFFER_WORDS, SE_STORY_WORDS, SE_TALK_WORDS } from '@ctf/shared';
import { AskForm } from './ask-form';
import { TalkForm } from './talk-form';
import styles from './new.module.css';

// + New: what a member can start. Ask is posted here; Talk books a TI Radio slot; an Offer or a
// Story opens where it is made.

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
      </h2>
      <p className={styles.text}>{intro}</p>
      {children}
    </section>
  );
}

export function NewScreen() {
  return (
    <>
      <Section id="se-new-ask" title={SE_ASK_WORDS.title} intro={SE_ASK_WORDS.intro}>
        <AskForm />
      </Section>
      <Section id="se-new-offer" title={SE_OFFER_WORDS.title} intro={SE_OFFER_WORDS.intro}>
        <div className={styles.choices}>
          {SE_OFFER_CHOICES.map((choice) => (
            <Link key={choice.key} href={choice.href} className={styles.choice}>
              <span className={styles.choiceTitle}>{choice.label}</span>
              <span className={styles.text}>{choice.text}</span>
            </Link>
          ))}
        </div>
      </Section>
      <Section id="se-new-story" title={SE_STORY_WORDS.title} intro={SE_STORY_WORDS.intro}>
        <Link href={SE_STORY_WORDS.href} className={styles.choice}>
          <span className={styles.choiceTitle}>{SE_STORY_WORDS.open}</span>
        </Link>
      </Section>
      <Section id="se-new-talk" title={SE_TALK_WORDS.title} intro={SE_TALK_WORDS.intro}>
        <TalkForm />
      </Section>
    </>
  );
}
