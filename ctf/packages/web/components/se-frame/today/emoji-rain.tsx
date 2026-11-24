'use client';

import { useEffect, useRef, useState } from 'react';
import { SE_EMOJI_RAIN_MS, seDaysWonSeenOn, seEmojiRainDrops, seEmojiRainStep } from '@ctf/shared';
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

// The total this browser last saw, beside the account's (seDaysWonSeenOn). Storage can be refused
// (private window, blocked site data); then the account's total decides alone.
const DEVICE_SEEN_KEY = 'ctf:se:days-won-seen';

function readDeviceSeen(): unknown {
  try {
    const raw = window.localStorage.getItem(DEVICE_SEEN_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    // no-trace: storage refused; the account's total decides.
    return null;
  }
}

function writeDeviceSeen(total: number): void {
  try {
    window.localStorage.setItem(DEVICE_SEEN_KEY, String(total));
  } catch {
    // no-trace: storage refused; the account's total is still recorded.
  }
}

// Decides once per new total, records it on this device and the account, and says whether to rain
// for a few seconds. A rise while Today is open (use-today.ts reads it again now and then) rains too.
export function useEmojiRain({ on, daysWon, seen, onSeen }: EmojiRainProps): boolean {
  const [raining, setRaining] = useState(false);
  const [device, setDevice] = useState<unknown>(undefined);
  useEffect(() => setDevice(readDeviceSeen()), []);
  const step = seEmojiRainStep({ on, total: daysWon?.total, sample: daysWon?.sample, seen: device === undefined ? undefined : seDaysWonSeenOn(device, seen) });
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  useEffect(() => {
    if (step.record === null) return;
    writeDeviceSeen(step.record);
    setDevice(step.record);
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

function RainDrops({ run }: { run: number }) {
  return (
    <div className={styles.rain} aria-hidden="true" data-testid="emoji-rain">
      {DROPS.map((drop) => (
        <span
          key={`${run}-${drop.key}`}
          className={styles.drop}
          style={{ left: `${drop.leftPct}%`, fontSize: drop.sizePx, animationDelay: `${drop.delayMs}ms`, animationDuration: `${drop.fallMs}ms` }}
        >
          {drop.emoji}
        </span>
      ))}
    </div>
  );
}

export function EmojiRain(props: EmojiRainProps) {
  const raining = useEmojiRain(props);
  if (!raining) return null;
  return <RainDrops run={0} />;
}

// One shower for each new `run` above zero, for a few seconds: signed-out Today's ticking preview
// count (guest-today.tsx) counts `run` up itself and never records anything.
export function EmojiRainShower({ run }: { run: number }) {
  const [raining, setRaining] = useState(false);
  useEffect(() => {
    if (run === 0 || prefersLessMotion()) return;
    setRaining(true);
    const timer = window.setTimeout(() => setRaining(false), SE_EMOJI_RAIN_MS);
    return () => window.clearTimeout(timer);
  }, [run]);
  if (!raining) return null;
  return <RainDrops run={run} />;
}
