'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;
// Same query the CSS uses to switch to the phone layout. Reading the breakpoint
// through matchMedia (rather than window.innerWidth) keeps the JS check and the
// CSS in lock-step — on some browsers innerWidth reported a desktop width even at
// phone size, which left every plugin stuck on its desktop layout.
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

// The server has no viewport, so it always renders the desktop layout; the client
// takes over with the real media-query result after hydration.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Returns true when the viewport matches the phone breakpoint (max-width: 767px).
 *
 * Backed by `useSyncExternalStore` + `matchMedia` so the client uses the correct
 * value from its first render after hydration (no desktop-to-mobile flash) and
 * stays exactly in sync with the CSS breakpoint.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
