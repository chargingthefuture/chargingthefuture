'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';

// On desktop every plugin/admin screen carries a "Back to all apps" arrow in the left icon rail
// (PluginRailFooter). The rail is hidden at phone width, which left mobile screens — including the
// admin surfaces — with no in-app way back: a member had to reach for the browser's own back button.
// This renders the missing control: one uniform back button pinned to the top-left of every screen at
// phone width, so the affordance is in the same place on every page (apps, plugin, and admin alike).
//
// It is mounted once in each of the three shared layouts (/apps, /plugin, /admin); a given route lives
// under exactly one of them, so it renders exactly once. It is hidden on desktop (the rail already has
// the control) and on the apps grid itself (that screen is the home — there is nowhere "back" to go).
// The admin hub (/admin) keeps the button so every admin screen, the hub included, has it.
const SUPPRESSED_PATHS = new Set(['/apps']);

export function MobileBackButton() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();

  if (!isMobile) {
    return null;
  }

  // The grid/home roots are a destination, not a step you go "back" from.
  if (pathname && SUPPRESSED_PATHS.has(pathname)) {
    return null;
  }

  function handleBack() {
    // Prefer real history-back so the button returns the member to wherever they came from. When the
    // screen was opened directly (a shared link, a fresh tab) there is no in-app history to pop, so
    // fall back to the all-apps grid — the same destination the desktop rail's back arrow uses.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/apps');
  }

  return (
    <div
      className="ctf-self-responsive"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        padding: '8px 12px',
        background: 'var(--ctf-bg, rgba(8, 8, 10, 0.92))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 40,
          padding: '0 14px 0 10px',
          borderRadius: 12,
          color: 'var(--ctf-text, #E5E7EB)',
          background: 'var(--ctf-surface, rgba(255, 255, 255, 0.06))',
          border: '1px solid var(--ctf-border, rgba(255, 255, 255, 0.12))',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </button>
    </div>
  );
}
