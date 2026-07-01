'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { resolveBackTarget } from '@/lib/nav/back-target';
import { MobileTopActions } from './mobile-top-actions';

// A uniform on-brand top bar for screens that do not build their own — chiefly the admin shells,
// which have no left icon rail. It mirrors the look the member shells already use (an accent-tinted
// back chevron + a brand icon + the screen title), and adds the shared MobileTopActions cluster
// (report a bug, account & settings, account menu) on the right at phone width.
//
// At phone width it renders the full mobile bar. On desktop these rail-less shells otherwise had no
// back control at all, so it renders a slim top bar with the same "Back to all apps" affordance —
// keeping the way back uniform across every screen and breakpoint. Shells that build their own
// desktop back (e.g. a desktop sidebar) pass `desktopBack={false}` to opt out and avoid duplicating.
//
// Self-gating: a caller drops it in unconditionally; it picks the right bar for the breakpoint.
// `accent` is the plugin's brand hex (the back chevron and icon tint to it); omit it for neutral chrome.
export function MobileScreenHeader({
  title,
  icon,
  accent,
  backHref = '/apps',
  desktopBack = true,
}: {
  title: string;
  icon?: ReactNode;
  accent?: string;
  backHref?: string;
  desktopBack?: boolean;
}) {
  const isMobile = useIsMobile();

  // One-level-up back destination, from the shared policy: admin area pages go to /admin, the admin
  // directory goes home, and everything else uses the caller's fallback (/apps). This keeps the back
  // control's destination and label consistent across every screen and breakpoint.
  const pathname = usePathname();
  const back = resolveBackTarget(pathname, backHref);

  // Derive translucent tints from the accent hex (#RRGGBB + alpha suffix). Fall back to neutral
  // surface tokens when no accent is supplied.
  const chevronBg = accent ? `${accent}1A` : 'var(--ctf-surface, rgba(255, 255, 255, 0.06))';
  const chevronBorder = accent ? `${accent}4D` : 'var(--ctf-border, rgba(255, 255, 255, 0.12))';
  const chevronColor = accent ?? 'var(--ctf-text, #E5E7EB)';

  // Desktop: a slim sticky bar carrying just the uniform back control. The shell renders its own
  // title/header below, so we deliberately do not repeat the title/icon here.
  if (!isMobile) {
    if (!desktopBack) {
      return null;
    }
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
          padding: '10px 16px',
          background: 'var(--ctf-bg, rgba(8, 8, 10, 0.96))',
          borderBottom: '1px solid var(--ctf-border, rgba(255, 255, 255, 0.08))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <Link
          href={back.href}
          aria-label={back.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 36,
            padding: '0 12px 0 9px',
            borderRadius: 10,
            background: chevronBg,
            border: `1px solid ${chevronBorder}`,
            color: chevronColor,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <ChevronLeft size={18} aria-hidden="true" /> {back.label}
        </Link>
      </div>
    );
  }

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
        href={back.href}
        aria-label={back.label}
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
