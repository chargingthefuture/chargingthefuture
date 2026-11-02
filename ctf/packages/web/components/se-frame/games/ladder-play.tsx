'use client';

import { useState } from 'react';
import { seCheckLadderStep, seLadderPath, type SeDailyPuzzle } from '@ctf/shared';
import styles from './games.module.css';

// The word ladder: type the next word, one letter changed, until the last word is reached. Undo takes
// back a step; Hint shows the next word on a shortest way from where the member is. The result is
// the number of steps.

type LadderPuzzle = Extract<SeDailyPuzzle, { kind: 'ladder' }>;

function Rung({ word, end }: { word: string; end?: boolean }) {
  return <span className={end ? `${styles.rung} ${styles.rungEnd}` : styles.rung}>{word.toUpperCase()}</span>;
}

export function LadderPlay({ puzzle, onDone }: { puzzle: LadderPuzzle; onDone: (_steps: number) => void }) {
  const [steps, setSteps] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const last = steps[steps.length - 1] ?? puzzle.start;
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const check = seCheckLadderStep(last, typed);
    if (!check.ok) return setNote(check.reason);
    const word = typed.trim().toLowerCase();
    setSteps([...steps, word]);
    setTyped('');
    setNote(null);
    if (word === puzzle.end) onDone(steps.length + 1);
  };
  const hint = () => {
    const path = seLadderPath(last, puzzle.end);
    setNote(path && path[1] ? `Try ${path[1].toUpperCase()}.` : 'No way from here. Undo a step.');
  };
  return (
    <>
      <div className={styles.ladder}>
        <Rung word={puzzle.start} />
        {steps.map((word, i) => (
          <Rung key={`${word}-${i}`} word={word} />
        ))}
        <Rung word={puzzle.end} end />
      </div>
      <form className={styles.ladderForm} onSubmit={add}>
        <label className={styles.srOnly} htmlFor="ladder-word">
          Next word after {last.toUpperCase()}
        </label>
        <input
          id="ladder-word"
          className={styles.input}
          value={typed}
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder={last.toUpperCase()}
          onChange={(event) => setTyped(event.target.value.replace(/[^a-zA-Z]/g, ''))}
        />
        <button type="submit" className={styles.primary}>
          Add
        </button>
      </form>
      {note ? (
        <p role="status" className={styles.ask}>
          {note}
        </p>
      ) : null}
      <div className={styles.resultActions}>
        <button type="button" className={styles.linkButton} disabled={steps.length === 0} onClick={() => setSteps(steps.slice(0, -1))}>
          Undo
        </button>
        <button type="button" className={styles.linkButton} onClick={hint}>
          Hint
        </button>
      </div>
      <p className={styles.text}>
        With everyday words it takes {puzzle.shortest} steps. Any number of steps finishes it.
      </p>
    </>
  );
}
