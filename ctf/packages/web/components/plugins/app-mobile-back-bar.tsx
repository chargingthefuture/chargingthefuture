import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

/**
 * Mobile-only "back to apps" bar shown above every plugin shell.
 *
 * Chyme already renders its own phone header with a back chevron; this gives
 * every other app the same affordance so a small-screen user always has a
 * consistent way back to the launcher. It is hidden at and above the 768px
 * breakpoint (`md:hidden`) — the desktop layouts have their own navigation —
 * and carries `ctf-self-responsive` so the phone "un-row" rule in globals.css
 * (which forces direct children of `.ctf-app-viewport` to `display:block`)
 * leaves its flex row alone. Theme-aware via the global `--ctf-*` tokens.
 */
export function AppMobileBackBar({ pluginName }: { pluginName: string }) {
  return (
    <div
      className="ctf-self-responsive md:hidden"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'var(--ctf-surface)',
        borderBottom: '1px solid var(--ctf-border)',
      }}
    >
      <Link
        href="/apps"
        aria-label="Back to apps"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ctf-text)',
          textDecoration: 'none',
          border: '1px solid var(--ctf-border)',
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={20} />
      </Link>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ctf-text)' }}>{pluginName}</span>
    </div>
  );
}
