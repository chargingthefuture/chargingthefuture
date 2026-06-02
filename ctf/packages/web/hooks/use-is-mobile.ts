'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

// The server has no viewport, so it always renders the desktop layout; the client
// then takes over with the real size.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Returns true when the viewport is narrower than the phone breakpoint (768px).
 *
 * Backed by `useSyncExternalStore` so the client uses the real viewport size from
 * its very first render after hydration — no post-mount flip from the desktop
 * layout to the mobile one (which showed up as a visible flash on load).
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
