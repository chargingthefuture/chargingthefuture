'use client';

import Link from 'next/link';

// Counterpart of PluginAdminButton for the admin side: a small accent-tinted pill in an admin
// surface's header linking to that plugin's member shell, so an admin can jump between the admin
// view and what members actually see without retyping URLs. Render it unconditionally on admin
// surfaces (they are already admin-gated).
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
