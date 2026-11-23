'use client';

import { SESSION_TODAY_PREFIX, readSessionPlace, writeSessionPlace } from 'lib/shared/session-place-store';

// Where the member was on Today, kept in sessionStorage so a reload puts them back: the card they
// had open (in place or in its sheet) and how far down the list they had scrolled. iOS unloads a
// background tab to free memory and the browser rebuilds the page on return; without this the
// member came back to a closed card at the top of the list. Only the most recently opened card is
// kept. The scroll is put back once per page load, so going to another tab and back to Today still
// starts at the top as before.

const OPEN_KEY = `${SESSION_TODAY_PREFIX}open-card`;
const SCROLL_KEY = `${SESSION_TODAY_PREFIX}scroll`;

export type OpenCardPlace = { id: string; sheet: boolean };

const read = readSessionPlace;
const write = writeSessionPlace;

export function readOpenCard(): OpenCardPlace | null {
  const raw = read(OPEN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OpenCardPlace>;
    return typeof parsed.id === 'string' ? { id: parsed.id, sheet: parsed.sheet === true } : null;
  } catch {
    return null;
  }
}

export function rememberOpenCard(place: OpenCardPlace): void {
  write(OPEN_KEY, JSON.stringify(place));
}

// Closing a card forgets it only when it is the one remembered.
export function forgetOpenCard(id: string): void {
  if (readOpenCard()?.id === id) write(OPEN_KEY, null);
}

// Read once, when this file first loads in the page, which is once per page load.
let savedScroll = typeof window === 'undefined' ? 0 : Number(read(SCROLL_KEY)) || 0;

// While Today is on screen, saves the scroll position whenever the page is hidden (switching apps,
// locking the phone), the last moment before iOS may unload the tab. The cleanup, run when the
// member leaves Today for another tab, forgets it, so a reload on another tab starts Today at the top.
export function keepTodayScroll(): () => void {
  const save = () => {
    if (document.visibilityState === 'hidden') write(SCROLL_KEY, String(Math.round(window.scrollY)));
  };
  const onPageHide = () => write(SCROLL_KEY, String(Math.round(window.scrollY)));
  document.addEventListener('visibilitychange', save);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    document.removeEventListener('visibilitychange', save);
    window.removeEventListener('pagehide', onPageHide);
    write(SCROLL_KEY, null);
  };
}

// Called once the cards have loaded, so the list is tall enough to scroll to the saved place.
export function putBackTodayScroll(): void {
  const saved = savedScroll;
  savedScroll = 0;
  if (saved > 0) window.requestAnimationFrame(() => window.scrollTo(0, saved));
}
