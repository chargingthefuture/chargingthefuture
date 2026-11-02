'use client';

import { useState } from 'react';
import type { SeDailyPuzzle, SeDailyWord } from '@ctf/shared';
import styles from './games.module.css';

// The word of the day: the meaning, and three words to choose from. A wrong pick is marked and the
// member tries again; the result is how many tries it took.

type WordPuzzle = Extract<SeDailyPuzzle, { kind: 'word' }>;

export function WordCard({ word }: { word: SeDailyWord }) {
  return (
    <div className={styles.wordCard}>
      <span className={styles.bigWord}>{word.word}</span>
      <span className={styles.ask}>
        ({word.part}) {word.meaning}
      </span>
      <span className={styles.text}>{word.sentence}</span>
    </div>
  );
}

export function WordPlay({ puzzle, onDone }: { puzzle: WordPuzzle; onDone: (_tries: number) => void }) {
  const [wrong, setWrong] = useState<number[]>([]);
  const pick = (index: number) => {
    if (index === puzzle.answer) return onDone(wrong.length + 1);
    setWrong((current) => [...current, index]);
  };
  return (
    <>
      <blockquote className={styles.quote}>{puzzle.word.meaning}</blockquote>
      <div className={styles.choices}>
        {puzzle.choices.map((choice, index) => (
          <button
            key={choice}
            type="button"
            className={wrong.includes(index) ? `${styles.choice} ${styles.wrong}` : styles.choice}
            disabled={wrong.includes(index)}
            onClick={() => pick(index)}
          >
            {choice}
          </button>
        ))}
      </div>
      {wrong.length > 0 ? <p className={styles.ask}>Not that one. Try another.</p> : null}
    </>
  );
}
