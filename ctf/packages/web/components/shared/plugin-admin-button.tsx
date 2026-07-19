'use client';

import Link from 'next/link';
import { markReplaceNav } from '@/lib/nav/back-history';

// Admin shortcut shown in a plugin's header — visible only to admins. Links to that
// plugin's /admin page. Matches the SkillsHunt admin pill: a small accent-tinted
// rounded button. `accent` lets each plugin tint it to match its own header. Renders
// nothing for non-admins, so callers can place it unconditionally.
//
// Navigates with REPLACE semantics — see PluginUserShellButton: toggling the admin↔member pair
// must not grow browser history, or back bounces between the two forever.
export function PluginAdminButton({
  href,
  isAdmin,
  accent = '#C8A84B',
  label = 'Admin',
}: {
  href: string;
  isAdmin?: boolean;
  accent?: string;
  label?: string;
}) {
  if (!isAdmin) return null;
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
      aria-label={`${label} panel`}
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
