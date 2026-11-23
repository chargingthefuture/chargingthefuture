'use client';

import { useEffect, useState } from 'react';
import { seGuestDaysWon, seGuestTickDelayMs, type SeToday } from '@ctf/shared';

// A sample Days won count goes up by one at random intervals while the page is open (owner
// decision, 2026-11-16): on signed-out Today, and signed in for an account on demo data. Nothing is
// written anywhere. `ticks` counts the steps so the caller can start one emoji shower per step.
// Pass null to keep the count still.
export function useLivelyDaysWon(daysWon: SeToday['daysWon'] | undefined) {
  const [ticks, setTicks] = useState(0);
  const shown = Boolean(daysWon);
  useEffect(() => {
    if (!shown) return;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        setTicks((count) => count + 1);
        next();
      }, seGuestTickDelayMs(Math.random()));
    };
    next();
    return () => window.clearTimeout(timer);
  }, [shown]);
  return { daysWon: seGuestDaysWon(daysWon, ticks), ticks };
}
