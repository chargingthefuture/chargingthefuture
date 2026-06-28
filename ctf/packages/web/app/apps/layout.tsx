import type { ReactNode } from 'react';
import { MobileBackButton } from '@/components/shared/mobile-back-button';

/**
 * Wraps every routed `/apps/*` screen in the shared app viewport. On phones this
 * lets each plugin shell's fixed desktop row fall back to a single scrolling
 * column (see `.ctf-app-viewport` in `globals.css`); on desktop it is an inert
 * full-width wrapper that changes nothing.
 *
 * The MobileBackButton supplies the phone-width back affordance (the desktop
 * icon rail's "back to all apps" arrow is hidden at this breakpoint); it renders
 * only on mobile and only off the apps grid home.
 */
export default function AppsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MobileBackButton />
      <div className="ctf-app-viewport">{children}</div>
    </>
  );
}
