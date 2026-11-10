'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SE_DAILY_GATE_WORDS as G, SE_DAILY_TITLES, seDailyPuzzle, type SeDailyGate } from '@ctf/shared';
import { useSeTheme } from '../use-se-theme';
import { seThemeVars } from '../se-theme-vars';
import frame from '../se-frame.module.css';
import styles from './games.module.css';

// The puzzle of the day for someone who may not play it (signed out, or a restricted account): what today's puzzle is and how it is played, and in place of the puzzle, what
// to do next. The play screens are not part of this page, so they are never sent.

type Gate = Exclude<SeDailyGate, 'play'>;

export function DailyGateScreen({ gate, reason, signInUrl }: { gate: Gate; reason: string | null; signInUrl: string }) {
  const { theme } = useSeTheme();
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => setDay(new Date().toISOString().slice(0, 10)), []);
  const puzzle = day ? seDailyPuzzle(day) : null;
  const words = puzzle ? SE_DAILY_TITLES[puzzle.kind] : null;
  const prompt = G[gate];
  const href = gate === 'sign-in' ? signInUrl : null;
  return (
    <div className={frame.frame} style={seThemeVars(theme.color, theme.mode)}>
      <main className={`${frame.screen} ${styles.screen}`}>
        <Link href="/" className={styles.linkButton}>
          Back to Today
        </Link>
        {puzzle && words ? (
          <header className={frame.header}>
            <span className={frame.eyebrow}>Puzzle of the day · No. {puzzle.number}</span>
            <h1 className={frame.title}>{words.title}</h1>
          </header>
        ) : null}
        <p className={styles.text}>{G.about}</p>
        {words ? <p className={styles.ask}>{words.ask}</p> : null}
        <section className={styles.result} aria-label={prompt.title}>
          <strong>{prompt.title}</strong>
          <span className={styles.text}>{prompt.body}</span>
          {reason ? <span className={styles.text}>The check failed: {reason}</span> : null}
          {href && prompt.button ? (
            <a href={href} className={`${styles.primary} ${styles.gateButton}`}>
              {prompt.button}
            </a>
          ) : null}
        </section>
      </main>
    </div>
  );
}
