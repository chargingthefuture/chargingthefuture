import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { seGuestDaysWon, seGuestTickDelayMs, type SeToday } from '@ctf/shared';

// A sample Days won count goes up by one at random intervals while the screen is open, with a shower
// of emoji drawn by the frame (owner decision, 2026-11-16), as on the web (use-lively-days-won.ts):
// on signed-out Today, and signed in for an account on demo data. Nothing is written anywhere, and
// with less motion asked for the number still ticks and no emoji fall. Pass null to keep it still.
export function useLivelyDaysWon(daysWon: SeToday['daysWon'] | undefined, onRain: () => void) {
  const [ticks, setTicks] = useState(0);
  const latest = useRef(onRain);
  latest.current = onRain;
  const shown = Boolean(daysWon);
  useEffect(() => {
    if (!shown) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      timer = setTimeout(() => {
        setTicks((count) => count + 1);
        AccessibilityInfo.isReduceMotionEnabled()
          .then((less) => {
            if (!less) latest.current();
          })
          .catch(() => undefined);
        next();
      }, seGuestTickDelayMs(Math.random()));
    };
    next();
    return () => clearTimeout(timer);
  }, [shown]);
  return seGuestDaysWon(daysWon, ticks);
}
