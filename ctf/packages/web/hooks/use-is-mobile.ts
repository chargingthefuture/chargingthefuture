'use client';

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when the viewport is narrower than the phone breakpoint (768px).
 *
 * Mirrors the design system's `use-mobile` hook so web shells can switch to the
 * single-column phone layout shown in the `Mobile*` mockups. Starts false so the
 * server renders the desktop layout; the client corrects it on mount.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}
