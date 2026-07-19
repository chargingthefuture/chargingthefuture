'use client';

import Link from 'next/link';
import { markReplaceNav } from '@/lib/nav/back-history';

// Counterpart of PluginAdminButton for the admin side: a small accent-tinted pill in an admin
// surface's header linking to that plugin's member shell, so an admin can jump between the admin
// view and what members actually see without retyping URLs. Render it unconditionally on admin
// surfaces (they are already admin-gated).
//
// Navigates with REPLACE semantics: the admin↔member pair is one surface seen from two sides, so
// toggling it must not grow browser history — otherwise the back button replays the toggles as an
// endless admin/member bounce (owner report, Directory). Back leaves the pair entirely.
export function PluginUserShellButton({
  href,
  accent = '#C8A84B',
  label = 'Member view',
}: {
  href: string;
  accent?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      replace
      onClick={(event) => {
        // Mark only when this click navigates in this tab; a modified/middle click opens a new
        // tab and must not poison the flag for the next same-tab navigation.
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          markReplaceNav();
        }
      }}
      aria-label={`Open the member view (${href})`}
      style={{
        height: 34,
        padding: '0 12px',
        borderRadius: 10,
        background: `${accent}1A`,
        border: `1px solid ${accent}40`,
        color: accent,
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 13,
        fontWeight: 700,
        textDecoration: 'none',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Link>
  );
}
