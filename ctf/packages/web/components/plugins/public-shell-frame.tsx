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
 * The control is a normal-flow sticky bar ABOVE the shell, on every breakpoint.
 * An earlier version used a `position: absolute` top-left corner overlay on
 * desktop, on the assumption that desktop shells kept their content inside a wide
 * side margin. That assumption was wrong: the landing shells render their own
 * header bar with the plugin icon/title hard against the top-left (only ~28px of
 * padding), so the overlay sat directly on top of that title. A normal-flow bar
 * never overlaps the shell's header — it reserves its own height — so it is the
 * one layout that is correct for every shell regardless of its header padding.
 */
const BACK_BUTTON_STYLE = {
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
  flexShrink: 0,
} as const;

export function PublicShellFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      {/* A normal-flow sticky bar above the shell, so it never overlaps the
          shell's own top-left brand/title on any breakpoint. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          background: 'var(--ctf-bg, #0B0B0F)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Link href="/apps" aria-label="Back to apps" style={BACK_BUTTON_STYLE}>
          <ChevronLeft size={20} />
        </Link>
      </div>

      {children}
    </div>
  );
}
