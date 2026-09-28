'use client';

import { useEffect, useRef, type RefObject } from 'react';

// How close to the bottom (in px) still counts as "at the latest message" when new entries arrive.
const NEAR_BOTTOM_PX = 120;

// True when the member's device asks for less motion (iOS/Android/desktop "Reduce motion").
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Smooth scrolling only when the device allows motion; an instant jump otherwise.
export function motionAwareBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

type ChatScrollOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  entryCount: number;
  // False until the first page of history has arrived.
  isReady: boolean;
  // CSS selector for the "New messages" divider, when one is drawn.
  dividerSelector?: string | null;
  // True when the newest entry is the member's own (a sent post or an @comic question).
  lastEntryIsOwn?: boolean;
  // True when the page opened on a deep link that positions the list itself.
  skipInitial?: boolean;
};

// Positions a chat list the way a normal chat app does:
// - On first open, jump with no animation to the "New messages" divider, or to the latest message
//   when there is nothing new. The member never watches the list scroll past the history.
// - Afterwards, follow new entries only when the member was already at the bottom or just posted,
//   so reading back up is never interrupted. That scroll is smooth unless the device asks for
//   reduced motion.
export function useChatScrollPosition({
  containerRef,
  entryCount,
  isReady,
  dividerSelector = null,
  lastEntryIsOwn = false,
  skipInitial = false,
}: ChatScrollOptions): void {
  const positionedRef = useRef(false);
  const wasNearBottomRef = useRef(true);

  // Remember whether the member is at the bottom before the next batch of entries lands.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef, isReady]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isReady || entryCount === 0) return;

    if (!positionedRef.current) {
      positionedRef.current = true;
      if (skipInitial) return;
      const divider = dividerSelector ? el.querySelector<HTMLElement>(dividerSelector) : null;
      el.scrollTop = divider
        ? Math.max(0, el.scrollTop + divider.getBoundingClientRect().top - el.getBoundingClientRect().top - 8)
        : el.scrollHeight;
      wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
      return;
    }

    if (wasNearBottomRef.current || lastEntryIsOwn) {
      el.scrollTo({ top: el.scrollHeight, behavior: motionAwareBehavior() });
      wasNearBottomRef.current = true;
    }
    // Runs only when the entry count changes; the other inputs are read at that moment.
  }, [entryCount, isReady]);
}
