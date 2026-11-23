'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { SE_UNLOCK_SCREEN_QUERY, seUnlockFocusFromQuery, seUnlockFocusQuery, type SeUnlockFocus } from '@ctf/shared';

// Opening the 3.1 Unlock screen from anywhere in the frame (the banner, People, + New → Talk). The
// screen is kept in the address (?unlock=1, beside the tab) so the back button closes it; the
// banner's "Why this step" and "Can't find it?" open it at that section (?unlock=why, ?unlock=help).

export const SeUnlockOpenContext = createContext<(focus?: SeUnlockFocus) => void>(() => undefined);

export function useOpenUnlock(): (focus?: SeUnlockFocus) => void {
  return useContext(SeUnlockOpenContext);
}

function readFocus(): SeUnlockFocus | null {
  if (typeof window === 'undefined') return null;
  return seUnlockFocusFromQuery(new URLSearchParams(window.location.search).get(SE_UNLOCK_SCREEN_QUERY));
}

function addressWith(focus: SeUnlockFocus | null): string {
  const params = new URLSearchParams(window.location.search);
  if (focus) params.set(SE_UNLOCK_SCREEN_QUERY, seUnlockFocusQuery(focus));
  else params.delete(SE_UNLOCK_SCREEN_QUERY);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

export function useUnlockScreenOpen(): { focus: SeUnlockFocus | null; show: (focus?: SeUnlockFocus) => void; close: () => void; forget: () => void } {
  const [focus, setFocus] = useState<SeUnlockFocus | null>(null);
  useEffect(() => {
    setFocus(readFocus());
    const onPop = () => setFocus(readFocus());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const show = useCallback((next: SeUnlockFocus = 'top') => {
    setFocus(next);
    window.history.pushState({ seUnlock: true }, '', addressWith(next));
    window.scrollTo(0, 0);
  }, []);
  const close = useCallback(() => {
    setFocus(null);
    if ((window.history.state as { seUnlock?: boolean } | null)?.seUnlock) window.history.back();
    else window.history.replaceState(null, '', addressWith(null));
  }, []);
  // A tab chosen while the screen is open replaces the address itself; only the screen is put away.
  const forget = useCallback(() => setFocus(null), []);
  return { focus, show, close, forget };
}
