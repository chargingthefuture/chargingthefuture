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
 * The control is anchored to a `position: relative` wrapper, never `position:
 * fixed`. A fixed element is positioned against the viewport only when no
 * ancestor establishes a containing block, but a parent with a transform /
 * filter / backdrop-filter does establish one — which previously threw the
 * button to the middle-right edge of the screen and clipped it. Anchoring to our
 * own wrapper resolves reliably regardless of any ancestor.
 *
 * Two breakpoints, because the landing shells differ:
 *  - Desktop shells lay their content out inside wide (~64px) side margins, so a
 *    top-left corner overlay sits in that margin and overlaps nothing.
 *  - Mobile shells run their own brand/title to the top-left edge, so an overlay
 *    there would sit on top of it. On phones the control is a normal-flow bar
 *    above the shell instead, which never collides.
 *
 * The `.ctf-bp-desktop` / `.ctf-bp-mobile` toggling lives on plain wrapper divs
 * (no inline `display`), because an inline `display` would beat the class rule
 * and defeat the breakpoint switch.
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
  backdropFilter: 'blur(4px)',
  flexShrink: 0,
} as const;

export function PublicShellFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      {/* Desktop: corner overlay inside the shell's side margin (adds no height). */}
      <div className="ctf-bp-desktop">
        <Link
          href="/apps"
          aria-label="Back to apps"
          style={{ position: 'absolute', top: 14, left: 14, zIndex: 50, ...BACK_BUTTON_STYLE }}
        >
          <ChevronLeft size={20} />
        </Link>
      </div>

      {/* Mobile: a normal-flow bar above the shell, so it never overlaps the
          shell's own top-left brand. */}
      <div className="ctf-bp-mobile">
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
      </div>

      {children}
    </div>
  );
}
