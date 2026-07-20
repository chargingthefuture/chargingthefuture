'use client';

/**
 * Mobile-first shell (owner decision, 2026-07-20): the app ships a single
 * phone-width layout at every viewport. On wide screens that layout renders
 * inside a centered phone-proportioned column (`.ctf-phone-frame` in
 * globals.css) instead of a separate desktop layout, so there is no second
 * layout to build or keep in step.
 *
 * This hook is therefore pinned to `true` on the server and the client alike:
 * every shell that branches on it renders its phone layout everywhere, and
 * server-rendered HTML matches the client with no post-hydration flip. The
 * hook is kept (rather than deleting its 70+ call sites) so a later owner
 * decision to revive per-viewport layouts only has to change this one file.
 */
export function useIsMobile(): boolean {
  return true;
}
