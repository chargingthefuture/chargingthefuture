import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Wraps a plugin's public / not-yet-verified visitor shell with a single
 * back-to-/apps control. These landing shells carry no navigation of their own
 * (none link back to the launcher), so without this a visitor who opened a
 * plugin from /apps had no on-screen way back. Verified members never see these
 * shells — they get the plugin's authenticated shell, which has its own designed
 * back button — so this control only ever appears where one was missing, and
 * never doubles an existing one.
 *
 * Fixed to the top-left so it overlays the shell without disturbing its layout;
 * neutral styling reads on every plugin's dark public background.
 */
export function PublicShellFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <Link
        href="/apps"
        aria-label="Back to apps"
        style={{
          position: 'fixed',
          top: 14,
          left: 14,
          zIndex: 50,
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F9FAFB',
          textDecoration: 'none',
          backdropFilter: 'blur(4px)',
        }}
      >
        <ChevronLeft size={20} />
      </Link>
      {children}
    </>
  );
}
