export type BackTarget = { href: string; label: string };

// Central policy for the in-app "back" control — the tailored one-level-up navigation, distinct
// from the browser/OS history back (which returns to whatever the visitor saw before). Keeping the
// rule in one place means every screen, on web and on Android, sends "back" to the same predictable
// place:
//   - an admin area page (/admin/<area>, any depth) goes up to the admin directory (/admin)
//   - the admin directory (/admin) goes up to the home hub (/)
//   - an account sub-page (/account/<section>) goes up to the account hub (/account)
//   - everything else (the account hub and member plugin screens) goes up to all apps (the fallback)
//
// `fallbackHref` is the destination for non-hierarchical screens; callers that already have a sensible
// default (the member shells use /apps) pass it through so this function only special-cases the trees.
export function resolveBackTarget(
  pathname: string | null | undefined,
  fallbackHref = '/apps',
): BackTarget {
  if (pathname === '/admin') {
    return { href: '/', label: 'Back to home' };
  }
  if (pathname && pathname.startsWith('/admin/')) {
    return { href: '/admin', label: 'Back to admin' };
  }
  if (pathname && pathname.startsWith('/account/')) {
    return { href: '/account', label: 'Back to your account' };
  }
  return { href: fallbackHref, label: 'Back to all apps' };
}
