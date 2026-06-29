'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileTopActions } from './mobile-top-actions';

// A uniform on-brand mobile top bar for screens that do not build their own — chiefly the admin
// shells, which on desktop relied on the left icon rail (hidden at phone width) and so had no back
// button or account/bug controls on mobile at all. It mirrors the look the member shells already use
// (an accent-tinted back chevron + a brand icon + the screen title), and adds the shared
// MobileTopActions cluster (report a bug, account & settings, account menu) on the right.
//
// Self-gating: renders only at phone width, so a caller can drop it in unconditionally and desktop is
// untouched. `accent` is the plugin's brand hex (the back chevron and icon tint to it); omit it for a
// neutral chrome.
export function MobileScreenHeader({
  title,
  icon,
  accent,
  backHref = '/apps',
}: {
  title: string;
  icon?: ReactNode;
  accent?: string;
  backHref?: string;
}) {
  const isMobile = useIsMobile();
  if (!isMobile) {
    return null;
  }

  // Derive translucent tints from the accent hex (#RRGGBB + alpha suffix). Fall back to neutral
  // surface tokens when no accent is supplied.
  const chevronBg = accent ? `${accent}1A` : 'var(--ctf-surface, rgba(255, 255, 255, 0.06))';
  const chevronBorder = accent ? `${accent}4D` : 'var(--ctf-border, rgba(255, 255, 255, 0.12))';
  const chevronColor = accent ?? 'var(--ctf-text, #E5E7EB)';

  return (
    <div
      className="ctf-self-responsive"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'var(--ctf-bg, rgba(8, 8, 10, 0.96))',
        borderBottom: '1px solid var(--ctf-border, rgba(255, 255, 255, 0.1))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <Link
        href={backHref}
        aria-label="Back to all apps"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: chevronBg,
          border: `1px solid ${chevronBorder}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: chevronColor,
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </Link>

      {icon ? (
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: accent ? `${accent}26` : 'var(--ctf-surface, rgba(255, 255, 255, 0.06))',
            border: `1px solid ${accent ? `${accent}66` : 'var(--ctf-border, rgba(255, 255, 255, 0.12))'}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: chevronColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      ) : null}

      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ctf-text, #F9FAFB)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </span>

      <MobileTopActions />
    </div>
  );
}
