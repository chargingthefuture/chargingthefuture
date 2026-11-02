'use client';

import { useState } from 'react';
import { SE_PUZZLE_WORDS, sePuzzleSolved, type SePuzzle } from '@ctf/shared';
import styles from './games.module.css';

// One puzzle being played. A choice puzzle is answered with one tap; a line-order puzzle by tapping
// the lines in turn. Either way the result slides up with the post and the next puzzle.

type Props = { puzzle: SePuzzle; title: string; url: string; onSolved: () => void; onNext: (() => void) | null };

function choiceClass(index: number, answer: number, picked: number | null): string {
  if (picked === null) return styles.choice;
  if (index === answer) return `${styles.choice} ${styles.right}`;
  return index === picked ? `${styles.choice} ${styles.wrong}` : styles.choice;
}

function Choices({ puzzle, onDone }: { puzzle: Extract<SePuzzle, { choices: string[] }>; onDone: (_right: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (index: number) => {
    if (picked !== null) return;
    setPicked(index);
    onDone(sePuzzleSolved(puzzle, index));
  };
  return (
    <div className={styles.choices}>
      {puzzle.choices.map((choice, index) => (
        <button key={index} type="button" className={choiceClass(index, puzzle.answer, picked)} disabled={picked !== null} onClick={() => pick(index)}>
          {choice}
        </button>
      ))}
    </div>
  );
}

function Lines({ puzzle, onDone }: { puzzle: Extract<SePuzzle, { kind: 'line-order' }>; onDone: (_right: boolean) => void }) {
  const [tapped, setTapped] = useState<number[]>([]);
  const [shown, setShown] = useState(false);
  const order = shown ? puzzle.order : tapped;
  const tap = (index: number) => {
    if (shown || tapped.includes(index)) return;
    const next = [...tapped, index];
    setTapped(next);
    if (next.length < puzzle.lines.length) return;
    const right = sePuzzleSolved(puzzle, next);
    setShown(!right);
    onDone(right);
  };
  return (
    <div className={styles.choices}>
      {puzzle.lines.map((line, index) => {
        const at = order.indexOf(index);
        return (
          <button key={index} type="button" className={`${styles.choice} ${styles.line}`} disabled={at >= 0} onClick={() => tap(index)}>
            <span className={styles.lineNumber}>{at >= 0 ? at + 1 : ''}</span>
            {line}
          </button>
        );
      })}
      {tapped.length > 0 && tapped.length < puzzle.lines.length ? (
        <button type="button" className={styles.linkButton} onClick={() => setTapped([])}>
          Start the order again
        </button>
      ) : null}
    </div>
  );
}

function Prompt({ puzzle }: { puzzle: SePuzzle }) {
  if (puzzle.kind === 'missing-word') {
    return (
      <blockquote className={styles.quote}>
        {puzzle.before}
        <span className={styles.gap}>_____</span>
        {puzzle.after}
      </blockquote>
    );
  }
  if (puzzle.kind === 'which-post') return <blockquote className={styles.quote}>{puzzle.excerpt}</blockquote>;
  return null;
}

export function PuzzlePlay({ puzzle, title, url, onSolved, onNext }: Props) {
  const [result, setResult] = useState<boolean | null>(null);
  const words = SE_PUZZLE_WORDS[puzzle.kind];
  const done = (right: boolean) => {
    setResult(right);
    if (right) onSolved();
  };
  return (
    <section className={styles.play} aria-label={words.title}>
      <span className={styles.kind}>{words.title}</span>
      <p className={styles.ask}>{words.ask}</p>
      <Prompt puzzle={puzzle} />
      {puzzle.kind === 'line-order' ? <Lines puzzle={puzzle} onDone={done} /> : <Choices puzzle={puzzle} onDone={done} />}
      {result === null ? null : (
        <div className={styles.result} role="status">
          <strong>{result ? 'Right.' : puzzle.kind === 'line-order' ? 'Not quite. The numbers show the order the post has.' : 'Not quite. The right one is marked.'}</strong>
          <span className={styles.from}>From: {title}</span>
          <div className={styles.resultActions}>
            <a href={url} className={styles.secondary} target="_blank" rel="noreferrer">
              Read the post
            </a>
            {onNext ? (
              <button type="button" className={styles.primary} onClick={onNext}>
                Next puzzle
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
