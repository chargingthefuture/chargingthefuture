'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { resolveBackTarget } from '@/lib/nav/back-target';

// History-aware back navigation (owner decision, 2026-07-17): the in-app back control returns to
// the PREVIOUS in-app page when there is one, and only falls back to the tailored one-level-up
// destination (resolveBackTarget) when there is no in-app history — e.g. the installed web app
// opened straight onto a deep link, where browser history has nowhere in-app to go.
//
// How it works: NavHistoryTracker (mounted once in the root layout) records each visited pathname
// in a sessionStorage stack. Going back pops the stack via the real browser history (router.back()),
// so scroll position and state restore the way members expect. The stack is per-tab and dies with
// the tab, which is exactly the lifetime browser history has.

const STORAGE_KEY = 'ctf-nav-history';
const MAX_STACK = 60;

function readStack(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-MAX_STACK)));
  } catch {
    // Storage full or unavailable — back simply falls back to one-level-up.
  }
}

// Mounted once in the root layout. Maintains the per-tab pathname stack: a forward navigation
// pushes; landing on the entry directly beneath the top means the member went BACK (browser or
// in-app), so it pops instead — keeping the stack in step with real history in both directions.
export function NavHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const stack = readStack();
    const top = stack[stack.length - 1];
    if (top === pathname) return; // same-page (query/hash) change — nothing to record
    if (stack.length > 1 && stack[stack.length - 2] === pathname) {
      stack.pop(); // returned to the previous page — a back, not a new visit
    } else {
      stack.push(pathname);
    }
    writeStack(stack);
  }, [pathname]);

  return null;
}

export type SmartBack = {
  // Navigate: previous in-app page when one exists, else the one-level-up fallback.
  goBack: () => void;
  // 'Back' when history back will be used; the tailored fallback label otherwise.
  label: string;
  hasHistory: boolean;
};

export function useSmartBack(fallbackHref = '/apps'): SmartBack {
  const pathname = usePathname();
  const router = useRouter();
  const fallback = resolveBackTarget(pathname, fallbackHref);

  // Read on the client after mount (sessionStorage is not available during SSR); re-check per page.
  const [hasHistory, setHasHistory] = useState(false);
  useEffect(() => {
    setHasHistory(readStack().length > 1);
  }, [pathname]);

  const goBack = useCallback(() => {
    if (readStack().length > 1) {
      router.back();
    } else {
      router.push(fallback.href);
    }
  }, [router, fallback.href]);

  return { goBack, label: hasHistory ? 'Back' : fallback.label, hasHistory };
}

// The standard mobile back control: the accent-tinted rounded-square chevron every screen uses at
// phone width (and inside member shells' own headers). One shared component so the way back looks
// and behaves the same everywhere — never hand-roll a back button (rule 134).
export function BackChevronButton({
  accent,
  size = 38,
  style,
}: {
  accent?: string;
  size?: number;
  style?: CSSProperties;
}) {
  const { goBack, label } = useSmartBack();
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: accent ? `${accent}1A` : 'var(--ctf-surface, rgba(255, 255, 255, 0.06))',
        border: `1px solid ${accent ? `${accent}4D` : 'var(--ctf-border, rgba(255, 255, 255, 0.12))'}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: accent ?? 'var(--ctf-text, #E5E7EB)',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        ...style,
      }}
    >
      <ChevronLeft size={Math.round(size * 0.53)} aria-hidden="true" />
    </button>
  );
}
