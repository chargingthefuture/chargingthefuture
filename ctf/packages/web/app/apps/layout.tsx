import type { ReactNode } from 'react';

/**
 * Wraps every routed `/apps/*` screen in the shared app viewport. On phones this
 * lets each plugin shell's fixed desktop row fall back to a single scrolling
 * column (see `.ctf-app-viewport` in `globals.css`); on desktop it is an inert
 * full-width wrapper that changes nothing.
 */
export default function AppsLayout({ children }: { children: ReactNode }) {
  return <div className="ctf-app-viewport">{children}</div>;
}
