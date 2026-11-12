'use client';

import { useEffect, useRef, useState } from 'react';
import { SE_EMOJI_RAIN_MS, seEmojiRainDrops, seEmojiRainStep } from '@ctf/shared';
import styles from './emoji-rain.module.css';

// Emoji rain (3.1 plan, Look): when the member has the switch on and the Days won total is higher
// than the last total their account saw, a few seconds of emoji fall over Today. No sound, nothing
// to tap, and nothing at all when the browser asks for less motion. The decision and the drops are
// shared with Android (seEmojiRainStep, seEmojiRainDrops).

const DROPS = seEmojiRainDrops();

function prefersLessMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type EmojiRainProps = {
  on: boolean;
  daysWon: { total: number; sample?: boolean } | null | undefined;
  seen: number | null | undefined;
  onSeen: (_total: number) => void;
};

// Decides once per new total, records it, and says whether to rain for a few seconds.
export function useEmojiRain({ on, daysWon, seen, onSeen }: EmojiRainProps): boolean {
  const [raining, setRaining] = useState(false);
  const step = seEmojiRainStep({ on, total: daysWon?.total, sample: daysWon?.sample, seen });
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  useEffect(() => {
    if (step.record === null) return;
    onSeenRef.current(step.record);
    if (step.rain && !prefersLessMotion()) setRaining(true);
  }, [step.record, step.rain]);

  useEffect(() => {
    if (!raining) return;
    const timer = window.setTimeout(() => setRaining(false), SE_EMOJI_RAIN_MS);
    return () => window.clearTimeout(timer);
  }, [raining]);

  return raining;
}

export function EmojiRain(props: EmojiRainProps) {
  const raining = useEmojiRain(props);
  if (!raining) return null;
  return (
    <div className={styles.rain} aria-hidden="true" data-testid="emoji-rain">
      {DROPS.map((drop) => (
        <span
          key={drop.key}
          className={styles.drop}
          style={{ left: `${drop.leftPct}%`, fontSize: drop.sizePx, animationDelay: `${drop.delayMs}ms`, animationDuration: `${drop.fallMs}ms` }}
        >
          {drop.emoji}
        </span>
      ))}
    </div>
  );
}
