import type { ReactNode } from 'react';
import { MobileBackButton } from '@/components/shared/mobile-back-button';

/**
 * Wraps every routed `/plugin/*` screen in the shared app viewport so plugin
 * shells reflow to a single scrolling column on phones. On desktop it is an
 * inert full-width wrapper. See `.ctf-app-viewport` in `globals.css`.
 *
 * The MobileBackButton supplies the phone-width back affordance (the desktop
 * icon rail's "back to all apps" arrow is hidden at this breakpoint).
 */
export default function PluginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MobileBackButton />
      <div className="ctf-app-viewport">{children}</div>
    </>
  );
}
