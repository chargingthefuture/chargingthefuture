'use client';

import { useState } from 'react';
import { sePictureSolved, type SeDailyPuzzle } from '@ctf/shared';
import { SceneSvg } from './scene-svg';
import styles from './games.module.css';

// The picture of the day, cut into strips and shuffled. Tap a strip, then another, to swap them.
// The result is how many swaps it took.

type PicturePuzzle = Extract<SeDailyPuzzle, { kind: 'picture' }>;

export function PicturePlay({ puzzle, onDone }: { puzzle: PicturePuzzle; onDone: (_swaps: number) => void }) {
  const [order, setOrder] = useState(puzzle.order);
  const [picked, setPicked] = useState<number | null>(null);
  const [swaps, setSwaps] = useState(0);
  const tap = (at: number) => {
    if (picked === null) return setPicked(at);
    if (picked === at) return setPicked(null);
    const next = [...order];
    [next[picked], next[at]] = [next[at], next[picked]];
    setOrder(next);
    setPicked(null);
    setSwaps(swaps + 1);
    if (sePictureSolved(next)) onDone(swaps + 1);
  };
  return (
    <div className={styles.picture}>
      {order.map((strip, at) => (
        <button
          key={strip}
          type="button"
          className={picked === at ? `${styles.strip} ${styles.stripPicked}` : styles.strip}
          aria-label={`Strip ${at + 1}${picked === at ? ', picked' : ''}`}
          aria-pressed={picked === at}
          onClick={() => tap(at)}
        >
          <SceneSvg shapes={puzzle.scene.shapes} strip={strip} />
        </button>
      ))}
      <span className={styles.text}>
        {swaps} swap{swaps === 1 ? '' : 's'} so far
      </span>
    </div>
  );
}
