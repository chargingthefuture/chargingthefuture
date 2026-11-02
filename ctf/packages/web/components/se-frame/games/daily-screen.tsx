'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SE_DAILY_TITLES, seDailyPuzzle, seDailyShareText, seLadderPath, type SeDailyPuzzle } from '@ctf/shared';
import { useSeTheme } from '../use-se-theme';
import { seThemeVars } from '../se-theme-vars';
import { LadderPlay } from './ladder-play';
import { PicturePlay } from './picture-play';
import { SceneSvg } from './scene-svg';
import { useDailyProgress } from './use-daily-progress';
import { WordCard, WordPlay } from './word-play';
import frame from '../se-frame.module.css';
import styles from './games.module.css';

// The puzzle of the day (3.1.0 plan, task 17): one puzzle, the same for everyone, taking turns
// between the word of the day, the picture of the day and the word ladder. No timer, no streak, no
// ranking, and no way to fail. Finishing shows how it went, a line to share, and tomorrow's kind.

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrow(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

function Play({ puzzle, onDone }: { puzzle: SeDailyPuzzle; onDone: (_result: number) => void }) {
  if (puzzle.kind === 'word') return <WordPlay puzzle={puzzle} onDone={onDone} />;
  if (puzzle.kind === 'picture') return <PicturePlay puzzle={puzzle} onDone={onDone} />;
  return <LadderPlay puzzle={puzzle} onDone={onDone} />;
}

function Answer({ puzzle }: { puzzle: SeDailyPuzzle }) {
  if (puzzle.kind === 'word') return <WordCard word={puzzle.word} />;
  if (puzzle.kind === 'picture') {
    return (
      <div className={styles.fullPicture}>
        <SceneSvg shapes={puzzle.scene.shapes} label={puzzle.scene.name} />
        <span className={styles.text}>{puzzle.scene.name}</span>
      </div>
    );
  }
  const path = seLadderPath(puzzle.start, puzzle.end) ?? [];
  return <p className={styles.text}>One short way: {path.map((word) => word.toUpperCase()).join(' → ')}</p>;
}

function Done({ puzzle, result }: { puzzle: SeDailyPuzzle; result: number }) {
  const [copied, setCopied] = useState<string | null>(null);
  const share = seDailyShareText(puzzle, result);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share);
      setCopied('Copied.');
    } catch (error) {
      setCopied(`Not copied: ${error instanceof Error ? error.message : 'the browser refused'}. The line above can be selected and copied.`);
    }
  };
  return (
    <div className={styles.result} role="status">
      <strong>Done.</strong>
      <Answer puzzle={puzzle} />
      <span className={styles.shareLine}>{share}</span>
      <div className={styles.resultActions}>
        <button type="button" className={styles.primary} onClick={() => void copy()}>
          Copy to share
        </button>
        <Link href="/" className={styles.secondary}>
          Back to Today
        </Link>
      </div>
      {copied ? <span className={styles.text}>{copied}</span> : null}
      <span className={styles.text}>Tomorrow: {SE_DAILY_TITLES[seDailyPuzzle(tomorrow(puzzle.day)).kind].title.toLowerCase()}.</span>
    </div>
  );
}

// The day is read in the browser, after the page loads, so the server and the browser never disagree
// about which puzzle is today's.
export function DailyScreen() {
  const { theme } = useSeTheme();
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => setDay(today()), []);
  return (
    <div className={frame.frame} style={seThemeVars(theme.color, theme.mode)}>
      <main className={`${frame.screen} ${styles.screen}`}>
        <Link href="/" className={styles.linkButton}>
          Back to Today
        </Link>
        {day ? <Puzzle day={day} /> : <p className={styles.text}>Loading today&apos;s puzzle…</p>}
      </main>
    </div>
  );
}

function Puzzle({ day }: { day: string }) {
  const puzzle = seDailyPuzzle(day);
  const { result, finish, notKept } = useDailyProgress(day);
  const words = SE_DAILY_TITLES[puzzle.kind];
  return (
    <>
      <header className={frame.header}>
        <span className={frame.eyebrow}>Puzzle of the day · No. {puzzle.number}</span>
        <h1 className={frame.title}>{words.title}</h1>
      </header>
      {result === null ? (
        <section className={styles.play} aria-label={words.title}>
          <p className={styles.ask}>{words.ask}</p>
          <Play puzzle={puzzle} onDone={finish} />
        </section>
      ) : (
        <Done puzzle={puzzle} result={result} />
      )}
      {notKept ? <p className={styles.text}>This browser refused to remember the result ({notKept}).</p> : null}
    </>
  );
}
