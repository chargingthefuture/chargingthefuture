'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { SE_UNLOCK_SCREEN_QUERY } from '@ctf/shared';

// Opening the 3.1 Unlock screen from anywhere in the frame (the banner, People, + New → Talk). The
// screen is kept in the address (?unlock=1, beside the tab) so the back button closes it.

export const SeUnlockOpenContext = createContext<() => void>(() => undefined);

export function useOpenUnlock(): () => void {
  return useContext(SeUnlockOpenContext);
}

function readOpen(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(SE_UNLOCK_SCREEN_QUERY) === '1';
}

function addressWith(open: boolean): string {
  const params = new URLSearchParams(window.location.search);
  if (open) params.set(SE_UNLOCK_SCREEN_QUERY, '1');
  else params.delete(SE_UNLOCK_SCREEN_QUERY);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

export function useUnlockScreenOpen(): { open: boolean; show: () => void; close: () => void; forget: () => void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(readOpen());
    const onPop = () => setOpen(readOpen());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const show = useCallback(() => {
    setOpen(true);
    window.history.pushState({ seUnlock: true }, '', addressWith(true));
    window.scrollTo(0, 0);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    if ((window.history.state as { seUnlock?: boolean } | null)?.seUnlock) window.history.back();
    else window.history.replaceState(null, '', addressWith(false));
  }, []);
  // A tab chosen while the screen is open replaces the address itself; only the screen is put away.
  const forget = useCallback(() => setOpen(false), []);
  return { open, show, close, forget };
}
